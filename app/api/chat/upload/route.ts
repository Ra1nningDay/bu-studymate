import { NextResponse } from "next/server";
import { isAiConfigured } from "@/lib/ai";
import {
  consumeRateLimit,
  fileUploadRateLimit,
  formatRateLimitMessage
} from "@/lib/rate-limit";
import { saveStudyFile } from "@/lib/study-file";
import { normalizeWebSessionId } from "@/lib/web-session";

export const runtime = "nodejs";

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : null;
}

export async function POST(request: Request) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart form body" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  const lineUserId = normalizeWebSessionId(getFormString(formData, "sessionId"));
  const rateLimit = await consumeRateLimit({
    lineUserId,
    ...fileUploadRateLimit
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: formatRateLimitMessage(rateLimit),
        retryAfterSeconds: rateLimit.retryAfterSeconds ?? 60
      },
      { status: 429 }
    );
  }

  try {
    const savedFile = await saveStudyFile({
      buffer: Buffer.from(await file.arrayBuffer()),
      courseName: getFormString(formData, "courseName"),
      fileName: file.name,
      lineUserId,
      mimeType: file.type
    });

    return NextResponse.json({
      aiConfigured: isAiConfigured(),
      fileName: savedFile.fileName,
      note: savedFile.note,
      pageCount: savedFile.pageCount,
      sourceType: savedFile.sourceType,
      usedOcr: savedFile.usedOcr,
      warnings: savedFile.warnings
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save study file" },
      { status: 400 }
    );
  }
}
