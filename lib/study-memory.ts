/**
 * Facade for backward compatibility.
 * Core study memory logic has been refactored to src/services/study-memory.service.ts
 */
export {
  studyMemoryService,
  StudyMemoryService,
  type SavedStudyNote
} from "@/src/services/study-memory.service";

import {
  studyMemoryService,
  type SavedStudyNote
} from "@/src/services/study-memory.service";
import type { StudyMaterialSourceType } from "@/lib/study-material-ingest";

export async function findCourseNameInMessage(lineUserId: string, message: string) {
  return studyMemoryService.findCourseNameInMessage(lineUserId, message);
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
  return studyMemoryService.saveStudyNote(lineUserId, courseName, rawText, options);
}

export async function getAssignments(lineUserId: string, courseName?: string | null) {
  return studyMemoryService.getAssignments(lineUserId, courseName);
}

export async function searchStudyMemory(lineUserId: string, query: string) {
  return studyMemoryService.searchStudyMemory(lineUserId, query);
}

export async function answerFromStudyMemory(
  lineUserId: string,
  userMessage: string,
  isThai: boolean = true,
  executionLog?: any[]
) {
  return studyMemoryService.answerFromStudyMemory(lineUserId, userMessage, isThai, executionLog);
}
