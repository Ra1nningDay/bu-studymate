import { NextResponse } from "next/server";
import { createBotReply } from "@/lib/bot";
import { createGreetingRichMessage, createStudyNoteFlex } from "@/lib/flex-messages";
import {
  getLineMessageContent,
  markLineMessageAsRead,
  replyLineText,
  replyLineMessage,
  showLineLoadingAnimation,
  verifyLineSignature,
  type LineWebhookEvent
} from "@/lib/line";
import { saveStudyFile, type SavedStudyFile } from "@/lib/study-file";

export const runtime = "nodejs";

async function handleTextMessage(event: LineWebhookEvent) {
  const replyToken = event.replyToken;
  const lineUserId = event.source?.userId;
  const message = event.message?.text?.trim();
  const markAsReadToken = event.message?.markAsReadToken;

  if (!replyToken || !lineUserId || !message) {
    return;
  }

  // Mark as read + show loading animation immediately (both fire-and-forget)
  if (markAsReadToken) {
    void markLineMessageAsRead(markAsReadToken);
  }
  void showLineLoadingAnimation(lineUserId);

  const reply = await createBotReply({ channel: "line", lineUserId, message });
  if (reply.flexMessage) {
    await replyLineMessage(replyToken, [reply.flexMessage]);
  } else {
    await replyLineText(replyToken, reply.text);
  }
}

async function handleFollowEvent(event: LineWebhookEvent) {
  const replyToken = event.replyToken;
  if (!replyToken) {
    return;
  }

  await replyLineMessage(replyToken, [createGreetingRichMessage()]);
}

function formatSavedStudyFileReply(file: SavedStudyFile) {
  const lines = [
    `สรุปบทเรียนให้แล้วครับ`,
    `วิชา: ${file.note.courseName}`,
    `ไฟล์: ${file.fileName}`,
    `ชนิดไฟล์: ${file.sourceType}${file.usedOcr ? " (ใช้ OCR)" : ""}`
  ];

  if (file.pageCount) {
    lines.push(`จำนวนหน้า: ${file.pageCount}`);
  }

  if (file.note.keyPoints.length > 0) {
    lines.push("หัวข้อหลัก:");
    lines.push(...file.note.keyPoints.slice(0, 5).map((point) => `- ${point}`));
  }

  if (file.note.summary) {
    lines.push(`จำง่าย ๆ: ${file.note.summary}`);
  }

  if (file.note.assignments.length > 0) {
    lines.push("งานที่พบ:");
    for (const assignment of file.note.assignments) {
      lines.push(`- ${assignment.title}`);
      if (assignment.dueDateText) {
        lines.push(`  กำหนดส่ง: ${assignment.dueDateText}`);
      }
    }
  }

  if (file.warnings.length > 0) {
    lines.push(`หมายเหตุ: ${file.warnings.join(" ")}`);
  }

  lines.push("เลือกปุ่มใน Study Pack เพื่อให้ช่วยติวต่อได้เลยครับ");

  return lines.join("\n");
}

async function handleFileMessage(event: LineWebhookEvent) {
  const replyToken = event.replyToken;
  const lineUserId = event.source?.userId;
  const messageId = event.message?.id;
  const fileName = event.message?.fileName;
  const mimeType = event.message?.mimeType;
  const markAsReadToken = event.message?.markAsReadToken;

  if (!replyToken || !lineUserId || !messageId) {
    return;
  }

  if (markAsReadToken) {
    void markLineMessageAsRead(markAsReadToken);
  }
  void showLineLoadingAnimation(lineUserId, 60);

  try {
    const buffer = await getLineMessageContent(messageId);
    const savedFile = await saveStudyFile({
      buffer,
      fileName,
      lineUserId,
      mimeType
    });

    await replyLineMessage(replyToken, [
      { type: "text", text: formatSavedStudyFileReply(savedFile) },
      createStudyNoteFlex(savedFile.note)
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "ไม่สามารถอ่านไฟล์นี้ได้ครับ";
    await replyLineText(
      replyToken,
      `ยังบันทึกไฟล์นี้ไม่ได้ครับ\n${message}\n\nรองรับไฟล์ PDF และ DOCX เท่านั้น`
    );
  }
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("x-line-signature");

  if (!verifyLineSignature(body, signature)) {
    return NextResponse.json({ ok: false, error: "Invalid LINE signature" }, { status: 401 });
  }

  const payload = JSON.parse(body) as { events?: LineWebhookEvent[] };

  for (const event of payload.events ?? []) {
    if (event.type === "follow") {
      await handleFollowEvent(event);
    } else if (event.type === "message" && event.message?.type === "text") {
      await handleTextMessage(event);
    } else if (event.type === "message" && event.message?.type === "file") {
      await handleFileMessage(event);
    }
  }

  return NextResponse.json({ ok: true });
}
