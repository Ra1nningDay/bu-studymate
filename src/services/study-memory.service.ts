import type { Prisma } from "@prisma/client";
import {
  studyMaterialRepository,
  type StudyMaterialRepository
} from "@/src/repositories/study-material.repository";
import {
  notebookRepository,
  type NotebookRepository
} from "@/src/repositories/notebook.repository";
import {
  lineFlexPresenter,
  type LineFlexPresenter
} from "@/src/presenters/line-flex.presenter";
import { generateStudyAnswer } from "@/lib/study-answer";
import { extractStudyNote } from "@/lib/study-extract";
import type { StudyMaterialSourceType } from "@/lib/study-material-ingest";
import { prisma } from "@/lib/prisma";
import { invalidateOverviewCorpusCounts } from "./admin-overview.service";

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

type StudyTutorAction = "FRIEND_EXPLAIN" | "REVIEW_QUESTIONS" | "FLASHCARDS" | "EXAM_SUMMARY";

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

function formatNotebookSummary(
  notebooks: Array<{
    emoji: string;
    name: string;
    noteCount: number;
  }>,
  uncategorizedCount: number,
  isThai: boolean
) {
  const totalNotes = notebooks.reduce((sum, nb) => sum + nb.noteCount, 0) + uncategorizedCount;

  if (totalNotes === 0) {
    return isThai
      ? "คุณยังไม่ได้บันทึกบทเรียนไว้ครับ ลองพิมพ์ /addnote <ชื่อวิชา> แล้วตามด้วยเนื้อหาที่เรียนดูนะครับ"
      : "You haven't saved any study materials yet. Try /addnote <Course Name> followed by the lesson content.";
  }

  if (!isThai) {
    const lines = [`You have ${totalNotes} note${totalNotes > 1 ? "s" : ""}.`, ""];
    for (const nb of notebooks) {
      lines.push(`${nb.emoji} ${nb.name} — ${nb.noteCount} note${nb.noteCount > 1 ? "s" : ""}`);
    }
    if (uncategorizedCount > 0) {
      lines.push(`📝 Uncategorized — ${uncategorizedCount} note${uncategorizedCount > 1 ? "s" : ""}`);
    }
    lines.push("", "Which course would you like to see?");
    return lines.join("\n");
  }

  const lines = [`ตอนนี้มีโน้ต ${totalNotes} รายการครับ`, ""];
  for (const nb of notebooks) {
    lines.push(`${nb.emoji} ${nb.name} — ${nb.noteCount} โน้ต`);
  }
  if (uncategorizedCount > 0) {
    lines.push(`📝 ไม่ระบุวิชา — ${uncategorizedCount} โน้ต`);
  }
  lines.push("", "อยากดูวิชาไหนครับ?");

  return lines.join("\n");
}

function formatTimeAgo(date: Date, isThai: boolean) {
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return isThai ? "วันนี้" : "today";
  if (diffDays === 1) return isThai ? "เมื่อวาน" : "yesterday";
  return isThai ? `${diffDays} วันที่แล้ว` : `${diffDays} days ago`;
}

function formatNotebookNotes(
  notebookName: string,
  notes: Array<{
    courseName: string;
    createdAt: Date;
    summary: string | null;
    title: string | null;
  }>,
  isThai: boolean
) {
  if (notes.length === 0) {
    return isThai
      ? `ไม่พบโน้ตในวิชา "${notebookName}" ครับ`
      : `No notes found in "${notebookName}".`;
  }

  const header = isThai
    ? `📘 ${notebookName} — ${notes.length} โน้ต`
    : `📘 ${notebookName} — ${notes.length} note${notes.length > 1 ? "s" : ""}`;

  const lines = [header, ""];
  notes.forEach((note, index) => {
    const timeAgo = formatTimeAgo(note.createdAt, isThai);
    lines.push(`${index + 1}. ${note.title ?? note.courseName} (${timeAgo})`);
    if (note.summary) {
      const shortSummary = note.summary.length > 80 ? note.summary.slice(0, 80) + "…" : note.summary;
      lines.push(`   ${shortSummary}`);
    }
  });

  lines.push("", isThai ? "อยากถามเรื่องไหนต่อครับ?" : "Which topic would you like to ask about?");

  return lines.join("\n");
}

export class StudyMemoryService {
  constructor(
    private repo: StudyMaterialRepository = studyMaterialRepository,
    private notebookRepo: NotebookRepository = notebookRepository,
    private flexPresenter: LineFlexPresenter = lineFlexPresenter
  ) {}

  async findCourseNameInMessage(lineUserId: string, message: string) {
    const courses = await this.repo.getUserCourses(lineUserId);
    const normalizedMessage = message.toLowerCase();

    return courses.find((course) => normalizedMessage.includes(course.toLowerCase())) ?? null;
  }

  async saveStudyNote(
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

    const notebook = await this.notebookRepo.findOrCreateByCourseName(lineUserId, cleanCourseName);

    const material = await this.repo.createMaterialWithChunksAndAssignments({
      courseName: cleanCourseName,
      keyPoints: extracted.keyPoints as Prisma.InputJsonValue,
      lineUserId,
      notebookId: notebook.id,
      rawText: cleanRawText,
      sourceType: options.sourceType ?? "text",
      summary: extracted.summary,
      title,
      assignments: extracted.assignments.map((assignment) => ({
        courseName: cleanCourseName,
        description: assignment.description,
        dueAt: assignment.dueAt,
        dueDateText: assignment.dueDateText,
        lineUserId,
        title: assignment.title
      })),
      chunks: chunks.map((chunk, index) => ({
        chunkIndex: index,
        content: chunk,
        courseName: cleanCourseName,
        lineUserId
      }))
    });

    invalidateOverviewCorpusCounts();

    return {
      assignments: extracted.assignments.map((assignment) => ({
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

  async getAssignments(lineUserId: string, courseName?: string | null) {
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

  async searchStudyMemory(lineUserId: string, query: string) {
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

  async answerFromStudyMemory(
    lineUserId: string,
    userMessage: string,
    isThai: boolean = true,
    executionLog?: any[],
    onTextDelta?: (delta: string) => void
  ): Promise<{ text: string; flexMessage?: any }> {
    if (isListNotesRequest(userMessage)) {
      executionLog?.push({ action: "Extract Intent", details: "Detected 'list notebooks' request — redirecting to listNotebooks" });
      return this.listNotebooks(lineUserId, isThai, executionLog);
    }

    executionLog?.push({ action: "Extract Intent", details: "Detected 'search study memory' request" });
    executionLog?.push({ action: "Search Database", details: `Querying Prisma for notes matching keywords from: "${userMessage.substring(0, 50)}..."` });
    const result = await this.searchStudyMemory(lineUserId, userMessage);
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
      const answer = await generateStudyAnswer(tutorPrompt, result.context, isThai, onTextDelta);

      if (answer === "ยังไม่พบข้อมูลนี้ในโน้ตที่บันทึกไว้ครับ" || answer === "I couldn't find this information in your saved notes.") {
        executionLog?.push({ action: "Format Response", details: "No tutor answer found in context" });
        return { text: answer };
      }

      const title = getStudyTutorTitle(tutorAction);
      executionLog?.push({ action: "Format Study Tutor Answer", details: `Generated ${title} with length ${answer.length}` });
      return { text: answer, flexMessage: this.flexPresenter.createStudyAnswerFlex(latestMaterial.courseName, title, answer) };
    }

    if (/สรุป|summary|latest class|last class|ล่าสุด/i.test(userMessage)) {
      if (!latestMaterial) {
        return { text: isThai ? "ยังไม่พบข้อมูลนี้ในโน้ตที่บันทึกไว้ครับ" : "I couldn't find this information in your saved notes." };
      }

      executionLog?.push({ action: "Format Summary Answer", details: `Used latest note: ${latestMaterial.courseName}` });
      const text = isThai
        ? `สรุปโน้ตวิชา ${latestMaterial.courseName} ล่าสุด:\n\n${latestMaterial.summary || latestMaterial.rawText.slice(0, 700)}`
        : `Latest summary for ${latestMaterial.courseName}:\n\n${latestMaterial.summary || latestMaterial.rawText.slice(0, 700)}`;

      return { text, flexMessage: this.flexPresenter.createStudyAnswerFlex(latestMaterial.courseName, "สรุปคลาส (Class Summary)", text) };
    }

    executionLog?.push({ action: "Generate Study Answer (OpenAI)" });
    const answer = await generateStudyAnswer(userMessage, result.context, isThai, onTextDelta);

    if (answer === "ยังไม่พบข้อมูลนี้ในโน้ตที่บันทึกไว้ครับ" || answer === "I couldn't find this information in your saved notes.") {
      executionLog?.push({ action: "Format Response", details: "No answer found in context" });
      return { text: answer };
    }

    executionLog?.push({ action: "Format Study Answer", details: `Generated answer with length ${answer.length}` });
    const flexMessage = result.materials[0]
      ? this.flexPresenter.createStudyAnswerFlex(result.materials[0].courseName, "Professor note", answer)
      : undefined;

    return { text: answer, flexMessage };
  }

  async listNotebooks(
    lineUserId: string,
    isThai: boolean = true,
    executionLog?: any[]
  ) {
    executionLog?.push({ action: "Query Notebooks", details: "Fetching notebook summary with note counts" });
    const [notebooks, uncategorizedCount] = await Promise.all([
      this.notebookRepo.getNotebooksWithCounts(lineUserId),
      this.notebookRepo.getUncategorizedCount(lineUserId)
    ]);
    executionLog?.push({ action: "Notebook Results", details: `Found ${notebooks.length} notebooks, ${uncategorizedCount} uncategorized` });

    return { text: formatNotebookSummary(notebooks, uncategorizedCount, isThai) };
  }

  async viewNotebook(
    lineUserId: string,
    userMessage: string,
    isThai: boolean = true,
    executionLog?: any[]
  ) {
    executionLog?.push({ action: "View Notebook", details: "Matching course name from message" });
    const courseName = await this.findCourseNameInMessage(lineUserId, userMessage);

    if (!courseName) {
      executionLog?.push({ action: "View Notebook", details: "No matching course found — falling back to listNotebooks" });
      return this.listNotebooks(lineUserId, isThai, executionLog);
    }

    executionLog?.push({ action: "Get Notebook Notes", details: `Course: ${courseName}` });
    const notes = await this.notebookRepo.getNotebookNotes(lineUserId, courseName);
    executionLog?.push({ action: "Notebook Notes", details: `Found ${notes.length} notes in ${courseName}` });

    return { text: formatNotebookNotes(courseName, notes, isThai) };
  }
}

export const studyMemoryService = new StudyMemoryService();

