import "pdf-parse/worker";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { recognize } from "tesseract.js";

export type StudyMaterialSourceType = "pdf" | "docx" | "ocr_pdf";

export type ExtractStudyMaterialInput = {
  buffer: Buffer;
  fileName?: string | null;
  mimeType?: string | null;
};

export type ExtractedStudyMaterialFile = {
  pageCount?: number;
  rawText: string;
  sourceType: StudyMaterialSourceType;
  usedOcr: boolean;
  warnings: string[];
};

import { env } from "@/src/config/env";

const maxOcrPages = env.STUDY_MEMORY_OCR_MAX_PAGES;
const ocrLanguage = env.STUDY_MEMORY_OCR_LANG;
const ocrScale = env.STUDY_MEMORY_OCR_SCALE;
const minimumPdfTextLength = env.STUDY_MEMORY_PDF_TEXT_MIN_CHARS;

function normalizeExtractedText(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

export function inferStudyFileSourceType({
  fileName,
  mimeType
}: {
  fileName?: string | null;
  mimeType?: string | null;
}): StudyMaterialSourceType | null {
  const lowerFileName = fileName?.toLowerCase() ?? "";
  const lowerMimeType = mimeType?.toLowerCase() ?? "";

  if (lowerMimeType.includes("pdf") || lowerFileName.endsWith(".pdf")) {
    return "pdf";
  }

  if (
    lowerMimeType.includes("wordprocessingml.document") ||
    lowerFileName.endsWith(".docx")
  ) {
    return "docx";
  }

  return null;
}

async function extractPdfText(buffer: Buffer) {
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText({
      pageJoiner: "\n\n--- page_number/total_number ---\n\n"
    });

    return {
      pageCount: result.total,
      text: normalizeExtractedText(result.text)
    };
  } finally {
    await parser.destroy();
  }
}

async function ocrPdf(buffer: Buffer) {
  const parser = new PDFParse({ data: buffer });
  const pageTexts: string[] = [];

  try {
    const screenshots = await parser.getScreenshot({
      first: maxOcrPages,
      imageBuffer: true,
      imageDataUrl: false,
      scale: ocrScale
    });

    for (const page of screenshots.pages) {
      const result = await recognize(Buffer.from(page.data), ocrLanguage, {
        logger: () => undefined
      });
      const text = normalizeExtractedText(result.data.text);
      if (text) {
        pageTexts.push(`--- ${page.pageNumber}/${screenshots.total} ---\n${text}`);
      }
    }

    return {
      pageCount: screenshots.total,
      text: normalizeExtractedText(pageTexts.join("\n\n"))
    };
  } finally {
    await parser.destroy();
  }
}

async function extractPdf(buffer: Buffer): Promise<ExtractedStudyMaterialFile> {
  const warnings: string[] = [];
  const extracted = await extractPdfText(buffer);

  if (extracted.text.length >= minimumPdfTextLength) {
    return {
      pageCount: extracted.pageCount,
      rawText: extracted.text,
      sourceType: "pdf",
      usedOcr: false,
      warnings
    };
  }

  if (!env.STUDY_MEMORY_OCR_ENABLED) {
    warnings.push("PDF text extraction found very little text and OCR is disabled.");
    return {
      pageCount: extracted.pageCount,
      rawText: extracted.text,
      sourceType: "pdf",
      usedOcr: false,
      warnings
    };
  }

  try {
    const ocrResult = await ocrPdf(buffer);
    if (!ocrResult.text) {
      warnings.push("OCR ran but did not find readable text.");
    }
    if (ocrResult.pageCount && ocrResult.pageCount > maxOcrPages) {
      warnings.push(`OCR scanned only the first ${maxOcrPages} pages.`);
    }

    return {
      pageCount: ocrResult.pageCount ?? extracted.pageCount,
      rawText: ocrResult.text || extracted.text,
      sourceType: "ocr_pdf",
      usedOcr: true,
      warnings
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown OCR error";
    warnings.push(`OCR failed: ${message}`);
    return {
      pageCount: extracted.pageCount,
      rawText: extracted.text,
      sourceType: "pdf",
      usedOcr: false,
      warnings
    };
  }
}

async function extractDocx(buffer: Buffer): Promise<ExtractedStudyMaterialFile> {
  const result = await mammoth.extractRawText({ buffer });
  const warnings = result.messages.map((message) => message.message).filter(Boolean);

  return {
    rawText: normalizeExtractedText(result.value),
    sourceType: "docx",
    usedOcr: false,
    warnings
  };
}

export async function extractStudyMaterialFile({
  buffer,
  fileName,
  mimeType
}: ExtractStudyMaterialInput): Promise<ExtractedStudyMaterialFile> {
  const sourceType = inferStudyFileSourceType({ fileName, mimeType });

  if (sourceType === "pdf") {
    return extractPdf(buffer);
  }

  if (sourceType === "docx") {
    return extractDocx(buffer);
  }

  throw new Error("Unsupported study material file type. Please upload a PDF or DOCX file.");
}
