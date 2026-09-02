import {
  extractStudyMaterialFile,
  type StudyMaterialSourceType
} from "@/lib/study-material-ingest";
import { saveStudyNote, type SavedStudyNote } from "@/lib/study-memory";

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
    throw new Error(`File is too large. Maximum size is ${Math.floor(maxStudyFileBytes / 1024 / 1024)} MB.`);
  }

  const safeFileName = fileName?.trim() || "uploaded-document";
  const extracted = await extractStudyMaterialFile({ buffer, fileName: safeFileName, mimeType });

  if (!extracted.rawText.trim()) {
    throw new Error("Could not extract readable text from this file.");
  }

  const note = await saveStudyNote(
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
