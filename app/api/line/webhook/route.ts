import { NextResponse } from "next/server";
import { answerKnowledgeQuestion } from "@/lib/knowledge";
import { classifyIntent, extractTicketCode } from "@/lib/intent";
import { replyLineText, verifyLineSignature, type LineWebhookEvent } from "@/lib/line";
import {
  continueTicketFlow,
  formatTicketStatusReply,
  getOrCreateChatSession,
  getTicketByCode
} from "@/lib/ticket";

export const runtime = "nodejs";

async function handleTextMessage(event: LineWebhookEvent) {
  const replyToken = event.replyToken;
  const lineUserId = event.source?.userId;
  const message = event.message?.text?.trim();

  if (!replyToken || !lineUserId || !message) {
    return;
  }

  const session = await getOrCreateChatSession(lineUserId);
  const intent = classifyIntent(message, session);
  let replyText: string;

  if (intent === "ASK_BU_INFO") {
    replyText = await answerKnowledgeQuestion(message);
  } else if (intent === "CREATE_TICKET") {
    replyText = await continueTicketFlow({ lineUserId, message, session });
  } else if (intent === "CHECK_TICKET_STATUS") {
    const ticketCode = extractTicketCode(message);
    if (!ticketCode) {
      replyText = "ขอรหัส Ticket ด้วยครับ เช่น เช็ค ticket BU-TICKET-0001";
    } else {
      const ticket = await getTicketByCode(ticketCode);
      replyText = ticket
        ? formatTicketStatusReply(ticket)
        : `ยังไม่พบ Ticket: ${ticketCode} ครับ`;
    }
  } else {
    replyText =
      "สวัสดีครับ ผมคือ BU StudyMate ช่วยตอบข้อมูลทั่วไปของ BU และรับแจ้งปัญหาห้องเรียน/สิ่งอำนวยความสะดวกได้ครับ";
  }

  await replyLineText(replyToken, replyText);
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("x-line-signature");

  if (!verifyLineSignature(body, signature)) {
    return NextResponse.json({ ok: false, error: "Invalid LINE signature" }, { status: 401 });
  }

  const payload = JSON.parse(body) as { events?: LineWebhookEvent[] };

  for (const event of payload.events ?? []) {
    if (event.type === "message" && event.message?.type === "text") {
      await handleTextMessage(event);
    }
  }

  return NextResponse.json({ ok: true });
}
