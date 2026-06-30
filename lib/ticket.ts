import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ChatSession, Ticket, TicketStatus } from "@/lib/types";
import { extractTicketDraftFromLLM } from "@/lib/ai";

export const ticketStatuses: TicketStatus[] = [
  "PENDING",
  "IN_PROGRESS",
  "RESOLVED"
];

export type TicketDraft = {
  location?: string;
  room?: string;
  description?: string;
};

const statusLabels: Record<TicketStatus, string> = {
  PENDING: "รอรับเรื่อง",
  IN_PROGRESS: "กำลังดำเนินการ",
  RESOLVED: "แก้ไขเรียบร้อย"
};

export function formatTicketStatus(status: TicketStatus) {
  return statusLabels[status] ?? status;
}

function isTicketStatus(status: string): status is TicketStatus {
  return ticketStatuses.includes(status as TicketStatus);
}

function toTicket(ticket: {
  id: string;
  ticketCode: string;
  lineUserId: string;
  location: string | null;
  room: string | null;
  description: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): Ticket {
  return {
    id: ticket.id,
    ticket_code: ticket.ticketCode,
    line_user_id: ticket.lineUserId,
    location: ticket.location,
    room: ticket.room,
    description: ticket.description,
    status: isTicketStatus(ticket.status) ? ticket.status : "PENDING",
    created_at: ticket.createdAt.toISOString(),
    updated_at: ticket.updatedAt.toISOString()
  };
}

function toDraftData(value: Prisma.JsonValue): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function toChatSession(session: {
  id: string;
  lineUserId: string;
  state: string;
  draftData: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}): ChatSession {
  return {
    id: session.id,
    line_user_id: session.lineUserId,
    state: session.state === "CREATING_TICKET" ? "CREATING_TICKET" : session.state === "CONFIRMING_TICKET" ? "CONFIRMING_TICKET" : "IDLE",
    draft_data: toDraftData(session.draftData),
    created_at: session.createdAt.toISOString(),
    updated_at: session.updatedAt.toISOString()
  };
}

function cleanValue(value?: string | null) {
  return value?.replace(/\s+/g, " ").trim() || undefined;
}

export async function parseTicketDraft(message: string): Promise<TicketDraft> {
  const llmExtraction = await extractTicketDraftFromLLM(message);
  if (llmExtraction) {
    return {
      location: cleanValue(llmExtraction.location),
      room: cleanValue(llmExtraction.room),
      description: cleanValue(llmExtraction.description)
    };
  }

  const locationMatch = message.match(
    /(อาคาร|ตึก|building)\s*([A-Za-z0-9ก-๙\s.-]+?)(?=\s*(ห้อง|room|lab|แอร์|โปรเจคเตอร์|projector|คอม|เสีย|ไม่|สกปรก|หาย|$))/i
  );
  const roomMatch =
    message.match(
      /(?:ห้อง|room)\s*([A-Za-z0-9ก-๙\s.-]+?)(?=\s*(แอร์|โปรเจคเตอร์|projector|คอม|เสีย|ไม่|สกปรก|หาย|$))/i
    ) ?? message.match(/\b(LAB\s*\d+)\b/i);

  let description = message;
  if (locationMatch?.[0]) description = description.replace(locationMatch[0], "");
  if (roomMatch?.[0]) description = description.replace(roomMatch[0], "");
  description = description.replace(/แจ้งปัญหา|แจ้ง|ช่วยดู|ช่วยหน่อย/gi, "").trim();

  const fallbackIssueMatch = message.match(
    /(แอร์.+|โปรเจคเตอร์.+|projector.+|คอม.+|computer.+|ห้อง.+สกปรก|.+เสีย|.+ไม่ทำงาน|.+ใช้ไม่ได้|ของหาย.+)/i
  );

  return {
    location: cleanValue(locationMatch?.[0]),
    room: cleanValue(roomMatch?.[0]),
    description: cleanValue(description) || cleanValue(fallbackIssueMatch?.[0])
  };
}

function mergeDraft(existing: Record<string, unknown>, next: TicketDraft): TicketDraft {
  return {
    location: next.location || (existing.location as string | undefined),
    room: next.room || (existing.room as string | undefined),
    description: next.description || (existing.description as string | undefined)
  };
}

function missingTicketFields(draft: TicketDraft) {
  const missing: string[] = [];
  if (!draft.location) missing.push("สถานที่หรืออาคาร");
  if (!draft.room) missing.push("ห้อง");
  if (!draft.description) missing.push("รายละเอียดปัญหา");
  return missing;
}

function buildMissingFieldsReply(missing: string[]) {
  return `รับเรื่องครับ ขอข้อมูลเพิ่มเติมหน่อยครับ: ${missing.join(
    ", "
  )}\nเช่น อาคาร A3 ชั้น 2 ห้อง LAB 2 แอร์ไม่เย็น`;
}

export async function getOrCreateChatSession(lineUserId: string) {
  const existing = await prisma.chatSession.findUnique({
    where: { lineUserId }
  });

  if (existing) {
    return toChatSession(existing);
  }

  const session = await prisma.chatSession.create({
    data: { lineUserId }
  });

  return toChatSession(session);
}

async function updateChatSession(lineUserId: string, values: Partial<ChatSession>) {
  await prisma.chatSession.update({
    where: { lineUserId },
    data: {
      state: values.state,
      draftData: (values.draft_data ?? {}) as Prisma.InputJsonValue
    }
  });
}

export async function resetTicketFlow(lineUserId: string) {
  await updateChatSession(lineUserId, {
    state: "IDLE",
    draft_data: {}
  });
}

async function generateTicketCode() {
  const data = await prisma.ticket.findMany({
    select: { ticketCode: true },
    orderBy: { createdAt: "desc" },
    take: 25
  });

  const maxNumber = data.reduce((max, ticket) => {
    const number = Number(String(ticket.ticketCode).match(/(\d+)$/)?.[1] ?? "0");
    return Number.isFinite(number) ? Math.max(max, number) : max;
  }, 0);

  return `BU-TICKET-${String(maxNumber + 1).padStart(4, "0")}`;
}

export async function createTicket({
  lineUserId,
  draft
}: {
  lineUserId: string;
  draft: Required<TicketDraft>;
}) {
  const ticketCode = await generateTicketCode();
  const ticket = await prisma.ticket.create({
    data: {
      ticketCode,
      lineUserId,
      location: draft.location,
      room: draft.room,
      description: draft.description,
      status: "IN_PROGRESS"
    }
  });

  return toTicket(ticket);
}

export async function continueTicketFlow({
  lineUserId,
  message,
  session
}: {
  lineUserId: string;
  message: string;
  session: ChatSession;
}): Promise<{ text: string; flexMessage?: any }> {
  if (session.state === "CONFIRMING_TICKET") {
    if (message.includes("ยืนยัน") || message.toLowerCase() === "yes" || message.includes("ใช่")) {
      const ticket = await createTicket({
        lineUserId,
        draft: session.draft_data as Required<TicketDraft>
      });
      await updateChatSession(lineUserId, { state: "IDLE", draft_data: {} });

      return { text: `รับเรื่องเรียบร้อยครับ\nTicket: ${ticket.ticket_code}\nสถานะ: ${formatTicketStatus(ticket.status)}` };
    } else if (message.includes("ยกเลิก") || message.toLowerCase() === "no" || message.includes("ไม่")) {
      await updateChatSession(lineUserId, { state: "IDLE", draft_data: {} });
      return { text: "ยกเลิกการแจ้งปัญหาเรียบร้อยครับ หากมีอะไรให้ช่วยเหลือพิมพ์บอกได้เลยครับ" };
    } else {
      return { text: "กรุณาพิมพ์ 'ยืนยัน' เพื่อส่งเรื่อง หรือ 'ยกเลิก' เพื่อยกเลิกครับ" };
    }
  }

  const parsedDraft = await parseTicketDraft(message);
  const draft = mergeDraft(session.draft_data ?? {}, parsedDraft);
  const missing = missingTicketFields(draft);

  if (missing.length > 0) {
    await updateChatSession(lineUserId, {
      state: "CREATING_TICKET",
      draft_data: draft
    });
    return { text: buildMissingFieldsReply(missing) };
  }

  await updateChatSession(lineUserId, {
    state: "CONFIRMING_TICKET",
    draft_data: draft
  });

  const confirmFlex = {
    type: "template",
    altText: "กรุณายืนยันการแจ้งปัญหา",
    template: {
      type: "confirm",
      text: `ข้อมูลถูกต้องไหมครับ?\nสถานที่: ${draft.location}\nห้อง: ${draft.room}\nปัญหา: ${draft.description}`,
      actions: [
        {
          type: "message",
          label: "ยืนยัน",
          text: "ยืนยัน"
        },
        {
          type: "message",
          label: "ยกเลิก",
          text: "ยกเลิก"
        }
      ]
    }
  };

  return {
    text: `กรุณาตรวจสอบข้อมูลก่อนส่งเรื่อง:\nอาคาร/สถานที่: ${draft.location}\nห้อง: ${draft.room}\nปัญหา: ${draft.description}`,
    flexMessage: confirmFlex
  };
}

export async function getTicketByCode(ticketCode: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { ticketCode }
  });

  return ticket ? toTicket(ticket) : null;
}

export async function listTickets() {
  const tickets = await prisma.ticket.findMany({
    orderBy: { createdAt: "desc" }
  });

  return tickets.map(toTicket);
}

export async function updateTicketStatus(id: string, status: TicketStatus) {
  if (!ticketStatuses.includes(status)) {
    throw new Error("Unsupported ticket status");
  }

  const ticket = await prisma.ticket.update({
    where: { id },
    data: { status }
  });

  return toTicket(ticket);
}

export function formatTicketStatusReply(ticket: Ticket) {
  return `Ticket: ${ticket.ticket_code}
สถานที่: ${ticket.location ?? "-"}
ห้อง: ${ticket.room ?? "-"}
ปัญหา: ${ticket.description}
สถานะ: ${formatTicketStatus(ticket.status)}`;
}
