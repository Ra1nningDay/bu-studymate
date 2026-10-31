import type { Intent } from "@/src/lib/router/intent";
import type { StudyMemoryService } from "@/src/services/study-memory.service";
import type { LineFlexPresenter } from "@/src/presenters/line-flex.presenter";
import { formatSavedStudyNoteReply, formatAssignmentsReply, formatAddNoteUsageReply } from "@/src/presenters/chat-workflow.presenter";
import type { ExecutionLogEntry } from "@/src/dtos/playground.dto";
import type { BotReply } from "../chat-contracts";
import { asReply } from "../chat-reply";

function parseAddNoteCommand(message: string) {
  const body = message.replace(/^\/addnote/i, "").trim();
  const [firstLine, ...restLines] = body.split(/\r?\n/);
  const courseName = firstLine?.trim();
  const rawText = restLines.join("\n").trim();

  if (!courseName || !rawText) {
    return null;
  }

  return { courseName, rawText };
}

export async function executeStudyWorkflow({
  intent, lineUserId, trimmedMessage, isThai, executionLog, onTextDelta
}: {
  intent: Extract<Intent, "ADD_STUDY_NOTE" | "LIST_ASSIGNMENTS" | "LIST_NOTEBOOKS" | "VIEW_NOTEBOOK" | "ASK_STUDY_MEMORY">;
  lineUserId: string;
  trimmedMessage: string;
  isThai: boolean;
  executionLog: ExecutionLogEntry[];
  onTextDelta?: (delta: string) => void;
}, studySvc: StudyMemoryService, flexPresenter: LineFlexPresenter): Promise<BotReply> {
  let reply: BotReply;
  if (intent === "ADD_STUDY_NOTE") {
    const parsed = parseAddNoteCommand(trimmedMessage);
    if (!parsed) {
      executionLog.push({ action: "Parse Add Note Command", details: "Failed to parse" });
      reply = asReply(
        formatAddNoteUsageReply(isThai),
        undefined,
        undefined,
        undefined,
        undefined,
        executionLog
      );
    } else {
      executionLog.push({ action: "Save Study Note", details: `Course: ${parsed.courseName}` });
      const note = await studySvc.saveStudyNote(lineUserId, parsed.courseName, parsed.rawText);
      reply = asReply(
        formatSavedStudyNoteReply(note, isThai),
        undefined,
        undefined,
        undefined,
        flexPresenter.createStudyNoteFlex(note),
        executionLog
      );
    }
  } else if (intent === "LIST_ASSIGNMENTS") {
    executionLog.push({ action: "Find Course Name" });
    const courseName = await studySvc.findCourseNameInMessage(lineUserId, trimmedMessage);
    executionLog.push({
      action: "Get Assignments",
      details: courseName ? `Course: ${courseName}` : "All courses"
    });
    const assignments = await studySvc.getAssignments(lineUserId, courseName);
    reply = asReply(
      formatAssignmentsReply(assignments, isThai),
      undefined,
      undefined,
      undefined,
      flexPresenter.createAssignmentsFlex(assignments),
      executionLog
    );
  } else if (intent === "LIST_NOTEBOOKS") {
    executionLog.push({ action: "List Notebooks" });
    const notebookReply = await studySvc.listNotebooks(
      lineUserId,
      isThai,
      executionLog
    );
    reply = asReply(
      notebookReply.text,
      undefined,
      undefined,
      undefined,
      undefined,
      executionLog
    );
  } else if (intent === "VIEW_NOTEBOOK") {
    executionLog.push({ action: "View Notebook" });
    const notebookReply = await studySvc.viewNotebook(
      lineUserId,
      trimmedMessage,
      isThai,
      executionLog
    );
    reply = asReply(
      notebookReply.text,
      undefined,
      undefined,
      undefined,
      undefined,
      executionLog
    );
  } else {
    executionLog.push({ action: "Search Study Memory" });
    const memoryReply = await studySvc.answerFromStudyMemory(
      lineUserId,
      trimmedMessage,
      isThai,
      executionLog,
      onTextDelta
    );
    reply = asReply(
      memoryReply.text,
      undefined,
      undefined,
      undefined,
      memoryReply.flexMessage,
      executionLog
    );
  }
  return reply;
}
