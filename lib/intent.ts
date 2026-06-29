import type { ChatSession } from "@/lib/types";

export type Intent =
  | "ASK_BU_INFO"
  | "CREATE_TICKET"
  | "CHECK_TICKET_STATUS"
  | "UNKNOWN";

const infoPatterns = [
  /wi-?fi|wifi|ไวไฟ|อินเทอร์เน็ต/i,
  /วันหยุด|holiday|calendar|ปฏิทิน/i,
  /กิจกรรม|activity|activities|ชมรม/i,
  /สมัคร|admission|admissions|รับสมัคร|หลักสูตร/i,
  /ห้องสมุด|library/i,
  /บัตรนักศึกษา|student id|id card/i,
  /อาคาร|ตึก|building|classroom|ห้องเรียน|แผนที่/i,
  /it support|รหัสผ่าน|บัญชี|ระบบ/i,
  /ทุน|scholarship/i,
  /ติดต่อ|contact|เบอร์|โทร|อีเมล/i
];

const ticketPatterns = [
  /แจ้ง|แจ้งปัญหา|เสีย|พัง|ไม่ทำงาน|ใช้ไม่ได้|สกปรก|หาย|ช่วย|ซ่อม/i,
  /แอร์|air|projector|โปรเจคเตอร์|คอม|computer|ห้อง|classroom|facility/i,
  /lost item|ของหาย/i
];

export function extractTicketCode(message: string) {
  return message.match(/BU-TICKET-\d{4,}/i)?.[0].toUpperCase() ?? null;
}

export function classifyIntent(message: string, session?: ChatSession | null): Intent {
  if (session?.state === "CREATING_TICKET") {
    return "CREATE_TICKET";
  }

  if (extractTicketCode(message) && /เช็ค|ตรวจ|status|สถานะ|ticket/i.test(message)) {
    return "CHECK_TICKET_STATUS";
  }

  if (ticketPatterns.some((pattern) => pattern.test(message))) {
    return "CREATE_TICKET";
  }

  if (infoPatterns.some((pattern) => pattern.test(message))) {
    return "ASK_BU_INFO";
  }

  return "UNKNOWN";
}
