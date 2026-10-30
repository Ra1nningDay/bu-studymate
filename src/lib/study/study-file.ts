import {
  extractStudyMaterialFile,
  type StudyMaterialSourceType
} from "@/lib/study-material-ingest";
import {
  studyMemoryService,
  type SavedStudyNote
} from "@/src/services/study-memory.service";
import {
  FileTooLargeError,
  TextExtractionError
} from "@/src/services/study.errors";

export type SavedStudyFile = {
  fileName: string;
  note: SavedStudyNote;
  pageCount?: number;
  sourceType: StudyMaterialSourceType;
  usedOcr: boolean;
  warnings: string[];
};

import { env } from "@/src/config/env";

const maxStudyFileBytes = env.STUDY_MEMORY_MAX_FILE_BYTES;

function stripKnownExtension(fileName: string) {
  return fileName.replace(/\.(pdf|docx)$/i, "");
}

export function inferCourseNameFromStudyFile(fileName?: string | null) {
  const baseName = stripKnownExtension(fileName?.trim() || "Uploaded Document")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return baseName || "Uploaded Document";
}

export async function saveStudyFile({
  buffer,
  courseName,
  fileName,
  lineUserId,
  mimeType
}: {
  buffer: Buffer;
  courseName?: string | null;
  fileName?: string | null;
  lineUserId: string;
  mimeType?: string | null;
}): Promise<SavedStudyFile> {
  if (buffer.byteLength > maxStudyFileBytes) {
    throw new FileTooLargeError(maxStudyFileBytes, buffer.byteLength);
  }

  const safeFileName = fileName?.trim() || "uploaded-document";
  const extracted = await extractStudyMaterialFile({ buffer, fileName: safeFileName, mimeType });

  if (!extracted.rawText.trim()) {
    throw new TextExtractionError();
  }

  const note = await studyMemoryService.saveStudyNote(
    lineUserId,
    courseName?.trim() || inferCourseNameFromStudyFile(safeFileName),
    extracted.rawText,
    {
      sourceType: extracted.sourceType,
      title: safeFileName
    }
  );

  return {
    fileName: safeFileName,
    note,
    pageCount: extracted.pageCount,
    sourceType: extracted.sourceType,
    usedOcr: extracted.usedOcr,
    warnings: extracted.warnings
  };
}
