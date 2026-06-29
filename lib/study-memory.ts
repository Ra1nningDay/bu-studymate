import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateStudyAnswer } from "@/lib/study-answer";
import { extractStudyNote } from "@/lib/study-extract";
import { createStudyAnswerFlex } from "@/lib/flex-messages";
import type { StudyMaterialSourceType } from "@/lib/study-material-ingest";

export type SavedStudyNote = {
  assignments: Array<{
    dueDateText: string | null;
    title: string;
  }>;
  courseName: string;
  materialId: string;
  summary: string | null;
  sourceType: "text" | StudyMaterialSourceType;
  title: string | null;
};

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function chunkText(rawText: string) {
  const paragraphs = rawText
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs.length ? paragraphs : [rawText]) {
    if ((current + "\n\n" + paragraph).length > 1200 && current) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.length ? chunks : [rawText.slice(0, 1200)];
}

function getQueryTokens(query: string) {
  return Array.from(new Set(query.toLowerCase().match(/[a-z0-9ก-๙]{2,}/gi) ?? []));
}

function includesText(value: string | null | undefined, needle: string) {
  return Boolean(value?.toLowerCase().includes(needle.toLowerCase()));
}

async function getUserCourses(lineUserId: string) {
  const materials = await prisma.studyMaterial.findMany({
    distinct: ["courseName"],
    orderBy: { createdAt: "desc" },
    select: { courseName: true },
    where: { lineUserId }
  });

  return materials.map((material) => material.courseName);
}

export async function findCourseNameInMessage(lineUserId: string, message: string) {
  const courses = await getUserCourses(lineUserId);
  const normalizedMessage = message.toLowerCase();

  return (
    courses.find((course) => normalizedMessage.includes(course.toLowerCase())) ?? null
  );
}

export async function saveStudyNote(
  lineUserId: string,
  courseName: string,
  rawText: string,
  options: {
    sourceType?: "text" | StudyMaterialSourceType;
    title?: string | null;
  } = {}
): Promise<SavedStudyNote> {
  const cleanCourseName = normalizeText(courseName);
  const cleanRawText = rawText.trim();
  const extracted = await extractStudyNote(cleanCourseName, cleanRawText);
  const chunks = chunkText(cleanRawText);
  const title = extracted.title ?? options.title ?? null;

  const material = await prisma.studyMaterial.create({
    data: {
      courseName: cleanCourseName,
      keyPoints: extracted.keyPoints as Prisma.InputJsonValue,
      lineUserId,
      rawText: cleanRawText,
      sourceType: options.sourceType ?? "text",
      summary: extracted.summary,
      title,
      assignments: {
        create: extracted.assignments.map((assignment) => ({
          courseName: cleanCourseName,
          description: assignment.description,
          dueAt: assignment.dueAt,
          dueDateText: assignment.dueDateText,
          lineUserId,
          title: assignment.title
        }))
      },
      chunks: {
        create: chunks.map((chunk, index) => ({
          chunkIndex: index,
          content: chunk,
          courseName: cleanCourseName,
          lineUserId
        }))
      }
    },
    include: {
      assignments: true
    }
  });

  return {
    assignments: material.assignments.map((assignment) => ({
      dueDateText: assignment.dueDateText,
      title: assignment.title
    })),
    courseName: material.courseName,
    materialId: material.id,
    summary: material.summary,
    sourceType: material.sourceType as "text" | StudyMaterialSourceType,
    title: material.title
  };
}

export async function getAssignments(lineUserId: string, courseName?: string | null) {
  return prisma.assignment.findMany({
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    take: 20,
    where: {
      lineUserId,
      status: "OPEN",
      ...(courseName ? { courseName: { equals: courseName, mode: "insensitive" } } : {})
    }
  });
}

function scoreMaterial({
  courseName,
  query,
  rawText,
  summary,
  title
}: {
  courseName: string;
  query: string;
  rawText: string;
  summary: string | null;
  title: string | null;
}) {
  const tokens = getQueryTokens(query);
  let score = 0;

  if (includesText(query, courseName)) score += 20;
  if (/ล่าสุด|latest|last|สรุปคลาส/i.test(query)) score += 5;

  for (const token of tokens) {
    if (includesText(courseName, token)) score += 8;
    if (includesText(title, token)) score += 5;
    if (includesText(summary, token)) score += 4;
    if (includesText(rawText, token)) score += 2;
  }

  return score;
}

export async function searchStudyMemory(lineUserId: string, query: string) {
  const [materials, assignments] = await Promise.all([
    prisma.studyMaterial.findMany({
      include: {
        chunks: {
          orderBy: { chunkIndex: "asc" },
          take: 5
        }
      },
      orderBy: { createdAt: "desc" },
      take: 25,
      where: { lineUserId }
    }),
    prisma.assignment.findMany({
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      take: 25,
      where: { lineUserId, status: "OPEN" }
    })
  ]);

  const rankedMaterials = materials
    .map((material) => ({
      material,
      score: scoreMaterial({
        courseName: material.courseName,
        query,
        rawText: material.rawText,
        summary: material.summary,
        title: material.title
      })
    }))
    .filter((entry) => entry.score > 0 || /ล่าสุด|latest|last|สรุปคลาส/i.test(query))
    .sort((a, b) => {
      if (/ล่าสุด|latest|last|สรุปคลาส/i.test(query)) {
        return b.material.createdAt.getTime() - a.material.createdAt.getTime();
      }

      return b.score - a.score;
    })
    .slice(0, 4);

  const queryTokens = getQueryTokens(query);
  const relevantAssignments = assignments.filter((assignment) => {
    return queryTokens.some((token) => {
      return (
        includesText(assignment.courseName, token) ||
        includesText(assignment.title, token) ||
        includesText(assignment.description, token) ||
        includesText(assignment.dueDateText, token)
      );
    });
  });

  const contextParts = [
    ...rankedMaterials.map(({ material }) => {
      const keyPoints = Array.isArray(material.keyPoints)
        ? material.keyPoints.join("\n- ")
        : "";
      const chunks = material.chunks.map((chunk) => chunk.content).join("\n\n");

      return `Course: ${material.courseName}
Saved at: ${material.createdAt.toISOString()}
Title: ${material.title ?? "-"}
Summary: ${material.summary ?? "-"}
Key points:
- ${keyPoints || "-"}
Saved note:
${chunks || material.rawText}`;
    }),
    relevantAssignments.length
      ? `Assignments:
${relevantAssignments
  .map((assignment) => {
    return `Course: ${assignment.courseName}
Title: ${assignment.title}
Due: ${assignment.dueDateText ?? assignment.dueAt?.toISOString() ?? "-"}
Description: ${assignment.description ?? "-"}`;
  })
  .join("\n\n")}`
      : ""
  ].filter(Boolean);

  return {
    context: contextParts.join("\n\n---\n\n"),
    contextParts,
    materials: rankedMaterials.map((entry) => entry.material),
    assignments: relevantAssignments
  };
}

export async function answerFromStudyMemory(lineUserId: string, userMessage: string, isThai: boolean = true, executionLog?: any[]) {
  if (/มีโน้ต|วิชาอะไรบ้าง|all notes|list notes|โน้ต.*อะไรบ้าง/i.test(userMessage)) {
    executionLog?.push({ action: "Extract Intent", details: "Detected 'list all courses' request" });
    const courses = await getUserCourses(lineUserId);
    if (courses.length === 0) {
      executionLog?.push({ action: "Query Database", details: `Queried unique course names for user. Found: 0 courses.` });
      return { text: isThai ? "คุณยังไม่ได้บันทึกโน้ตวิชาไหนเลยครับ ลองพิมพ์ /addnote <ชื่อวิชา> ดูนะครับ" : "You haven't saved any notes yet." };
    }
    executionLog?.push({ action: "Query Database", details: `Queried unique course names for user. Found ${courses.length} courses: ${courses.join(', ')}` });
    return { text: isThai ? `ตอนนี้คุณมีโน้ตของวิชาเหล่านี้ครับ:\n- ${courses.join("\n- ")}` : `You have notes for these courses:\n- ${courses.join("\n- ")}` };
  }

  executionLog?.push({ action: "Extract Intent", details: "Detected 'search study memory' request" });
  executionLog?.push({ action: "Search Database", details: `Querying Prisma for notes matching keywords from: "${userMessage.substring(0, 50)}..."` });
  const result = await searchStudyMemory(lineUserId, userMessage);
  const latestMaterial = result.materials[0];
  
  if (result.materials.length > 0 || result.assignments.length > 0) {
    executionLog?.push({ action: "Search Results", details: `Matched ${result.materials.length} notes (Top match: ${result.materials[0]?.courseName}) and ${result.assignments.length} assignments.` });
  } else {
    executionLog?.push({ action: "Search Results", details: `No relevant notes or assignments found in database.` });
  }

  if (/สรุป|summary|latest class|last class|ล่าสุด/i.test(userMessage)) {
    if (!latestMaterial) {
      return { text: isThai ? "ยังไม่พบข้อมูลนี้ในโน้ตที่บันทึกไว้ครับ" : "I couldn't find this information in your saved notes." };
    }

    executionLog?.push({ action: "Format Summary Answer", details: `Used latest note: ${latestMaterial.courseName}` });
    const text = isThai
      ? `สรุปโน้ตวิชา ${latestMaterial.courseName} ล่าสุด:\n\n${latestMaterial.summary || latestMaterial.rawText.slice(0, 700)}`
      : `Latest summary for ${latestMaterial.courseName}:\n\n${latestMaterial.summary || latestMaterial.rawText.slice(0, 700)}`;

    return { text, flexMessage: createStudyAnswerFlex(latestMaterial.courseName, "สรุปคลาส (Class Summary)", text) };
  }

  executionLog?.push({ action: "Generate Study Answer (OpenAI)" });
  const answer = await generateStudyAnswer(userMessage, result.context, isThai);
  
  if (answer === "ยังไม่พบข้อมูลนี้ในโน้ตที่บันทึกไว้ครับ" || answer === "I couldn't find this information in your saved notes.") {
    executionLog?.push({ action: "Format Response", details: "No answer found in context" });
    return { text: answer };
  }
  
  executionLog?.push({ action: "Format Study Answer", details: `Generated answer with length ${answer.length}` });
  const flexMessage = result.materials[0] ? createStudyAnswerFlex(result.materials[0].courseName, "Professor note", answer) : undefined;
  return { text: answer, flexMessage };
}
