import { NextResponse } from "next/server";
import { isAiConfigured } from "@/lib/ai";
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

  try {
    const savedFile = await saveStudyFile({
      buffer: Buffer.from(await file.arrayBuffer()),
      courseName: getFormString(formData, "courseName"),
      fileName: file.name,
      lineUserId: normalizeWebSessionId(getFormString(formData, "sessionId")),
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
