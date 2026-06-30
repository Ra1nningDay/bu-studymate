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
  keyPoints: string[];
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

async function getUserStudyMaterials(lineUserId: string) {
  return prisma.studyMaterial.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      courseName: true,
      createdAt: true,
      sourceType: true,
      summary: true,
      title: true
    },
    take: 5,
    where: { lineUserId }
  });
}

function formatSavedMaterialsList(
  materials: Awaited<ReturnType<typeof getUserStudyMaterials>>,
  isThai: boolean
) {
  if (materials.length === 0) {
    return isThai
      ? "คุณยังไม่ได้บันทึกบทเรียนไว้ครับ ลองพิมพ์ /addnote <ชื่อวิชา> แล้วตามด้วยเนื้อหาที่เรียนดูนะครับ"
      : "You haven't saved any study materials yet. Try /addnote <Course Name> followed by the lesson content.";
  }

  if (!isThai) {
    const lines = ["Here are your latest saved study materials:"];
    materials.forEach((material, index) => {
      lines.push(`${index + 1}. ${material.courseName}${material.title ? ` - ${material.title}` : ""}`);
      if (material.summary) lines.push(`   ${material.summary}`);
    });
    lines.push("Ask about a course name or the latest lesson when you want to continue.");
    return lines.join("\n");
  }

  const lines = ["ตอนนี้มีบทเรียนที่บันทึกไว้ล่าสุดครับ"];
  materials.forEach((material, index) => {
    lines.push(`${index + 1}. ${material.courseName}${material.title ? ` - ${material.title}` : ""}`);
    if (material.summary) {
      lines.push(`   ${material.summary}`);
    }
  });
  lines.push("พิมพ์ชื่อวิชา หรือถามต่อจากบทเรียนล่าสุดได้เลยครับ");

  return lines.join("\n");
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
    keyPoints: extracted.keyPoints,
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

type StudyTutorAction = "FRIEND_EXPLAIN" | "REVIEW_QUESTIONS" | "FLASHCARDS" | "EXAM_SUMMARY";

function getStudyTutorAction(message: string): StudyTutorAction | null {
  if (/อธิบายโน้ตล่าสุดแบบเพื่อนสอน|อธิบาย.*เพื่อนสอน/i.test(message)) return "FRIEND_EXPLAIN";
  if (/ออกคำถามทบทวนจากโน้ตล่าสุด|คำถามทบทวน/i.test(message)) return "REVIEW_QUESTIONS";
  if (/flashcards|แฟลชการ์ด/i.test(message)) return "FLASHCARDS";
  if (/สรุปก่อนสอบจากโน้ตล่าสุด|สรุปก่อนสอบ/i.test(message)) return "EXAM_SUMMARY";
  return null;
}

function getStudyTutorTitle(action: StudyTutorAction) {
  switch (action) {
    case "FRIEND_EXPLAIN":
      return "อธิบายแบบเพื่อนสอน";
    case "REVIEW_QUESTIONS":
      return "คำถามทบทวน";
    case "FLASHCARDS":
      return "Flashcards";
    case "EXAM_SUMMARY":
      return "สรุปก่อนสอบ";
  }
}

function buildStudyTutorPrompt(action: StudyTutorAction, courseName: string) {
  switch (action) {
    case "FRIEND_EXPLAIN":
      return (
        `อธิบายบทเรียนล่าสุดของวิชา ${courseName} แบบเพื่อนสอนเพื่อน ` +
        "ให้เหมือนคนกำลังคุยกัน ไม่ใช่คัดลอกโน้ตมาตอบ เริ่มจากภาพรวมง่าย ๆ แล้วอธิบาย 2-4 จุดสำคัญด้วยภาษาธรรมชาติ " +
        "ถ้ามีคำว่า Today หรือ วันนี้ในโน้ต ให้แปลงเป็นคำอธิบายบทเรียนแทน อย่าใช้สำนวนไดอารี่แบบ 'วันนี้เรียน' เว้นแต่จำเป็น"
      );
    case "REVIEW_QUESTIONS":
      return `สร้างคำถามทบทวน 5 ข้อจากบทเรียนล่าสุดของวิชา ${courseName} พร้อมเฉลยสั้น ๆ ใช้ภาษาคุยง่ายและอิงเฉพาะข้อมูลในโน้ต`;
    case "FLASHCARDS":
      return `ทำ flashcards 5 ใบจากบทเรียนล่าสุดของวิชา ${courseName} รูปแบบ Q: ... A: ... ให้สั้น อ่านง่าย และอิงเฉพาะข้อมูลในโน้ต`;
    case "EXAM_SUMMARY":
      return (
        `สรุปก่อนสอบจากบทเรียนล่าสุดของวิชา ${courseName} เป็นหัวข้อสั้น ๆ ` +
        "แบ่งเป็น ต้องจำอะไร, จุดที่มักสับสน, และทวนเร็ว ใช้ภาษาง่าย ไม่คัดลอกโน้ตยาว ๆ"
      );
  }
}

function isListNotesRequest(message: string) {
  const noteWord = "(?:โน[้๊]?ต|notes?)";
  const hasListVerbNearNote = new RegExp(`(?:มี|ดู|แสดง|list|all).{0,20}${noteWord}`, "i").test(message);
  const hasNoteNearListQuestion = new RegExp(`${noteWord}.{0,30}(?:อะไรบ้าง|ทั้งหมด|ที่บันทึกไว้|saved)`, "i").test(message);
  const hasGenericSavedQuestion = /(?:มี|ดู|แสดง).{0,20}(?:อะไร|ความรู้|บทเรียน|เนื้อหา).{0,20}บันทึก.{0,10}(?:ไว้|บ้าง)|(?:ความรู้|บทเรียน|เนื้อหา).{0,20}(?:เคย)?บันทึก|บันทึก(?:อะไร|อะไรไว้|ไว้บ้าง)/i.test(message);

  return hasListVerbNearNote || hasNoteNearListQuestion || hasGenericSavedQuestion || /วิชาอะไรบ้าง|all notes|list notes/i.test(message);
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
  if (isListNotesRequest(userMessage)) {
    executionLog?.push({ action: "Extract Intent", details: "Detected 'list saved study materials' request" });
    const materials = await getUserStudyMaterials(lineUserId);
    executionLog?.push({ action: "Query Database", details: `Queried latest saved study materials. Found: ${materials.length}.` });
    return { text: formatSavedMaterialsList(materials, isThai) };
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

  const tutorAction = getStudyTutorAction(userMessage);
  if (tutorAction) {
    if (!latestMaterial) {
      return { text: isThai ? "ยังไม่พบข้อมูลนี้ในโน้ตที่บันทึกไว้ครับ" : "I couldn't find this information in your saved notes." };
    }

    executionLog?.push({ action: "Generate Study Tutor Answer (OpenAI)", details: getStudyTutorTitle(tutorAction) });
    const tutorPrompt = buildStudyTutorPrompt(tutorAction, latestMaterial.courseName);
    const answer = await generateStudyAnswer(tutorPrompt, result.context, isThai);

    if (answer === "ยังไม่พบข้อมูลนี้ในโน้ตที่บันทึกไว้ครับ" || answer === "I couldn't find this information in your saved notes.") {
      executionLog?.push({ action: "Format Response", details: "No tutor answer found in context" });
      return { text: answer };
    }

    const title = getStudyTutorTitle(tutorAction);
    executionLog?.push({ action: "Format Study Tutor Answer", details: `Generated ${title} with length ${answer.length}` });
    return { text: answer, flexMessage: createStudyAnswerFlex(latestMaterial.courseName, title, answer) };
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
