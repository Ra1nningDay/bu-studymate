import { classifyWithAgentRouter } from "@/src/lib/router/agent-router";
import { extractTicketCode } from "@/src/lib/router/intent";
import type { ChatSession } from "@/src/lib/types";
import type { ResolvedRoute } from "../chat-contracts";

const safetyCriticalHintPattern =
  /(ทำร้ายตัวเอง|ฆ่าตัวตาย|ไม่อยากมีชีวิต|ไม่อยากอยู่แล้ว|อยากตาย|จบชีวิต|กรีดข้อมือ|กินยาเกินขนาด|กระโดดตึก|ไฟไหม้|เพลิงไหม้|ระเบิด|ถูกทำร้าย|มีคนถือมีด|มีปืน|อันตรายถึงชีวิต|ช่วยชีวิต|หมดสติ|เลือดออกมาก|หายใจไม่ออก|hurt\s+myself|kill\s+myself|end\s+my\s+life|suicid|self[- ]?harm|overdose|immediate\s+danger|on\s+fire|bomb|gunman|stabbing|bleeding\s+heavily|unconscious)/i;

export function mightBeSafetyCritical(message: string): boolean {
  return safetyCriticalHintPattern.test(message);
}

function isResetOrCancelCommand(message: string) {
  return /^(\/reset|cancel|ยกเลิก)$/i.test(message.trim());
}

function normalizeMenuMessage(message: string) {
  return message.replace(/\s+/g, " ").trim().toLowerCase();
}

const deterministicMenuMessages = new Set([
  "อัปโหลดบทเรียน",
  "ถามข้อมูล bu",
  "ถามข้อมูลทั่วไป",
  "แจ้งปัญหาห้องเรียน",
  "งานที่ต้องส่งมีอะไรบ้าง",
  "ดูบันทึกโน้ต",
  "ถามจากบทเรียนนี้"
]);

export function canResolveWithoutRouter(trimmedMessage: string): boolean {
  const menuMessage = normalizeMenuMessage(trimmedMessage);
  if (deterministicMenuMessages.has(menuMessage) || isResetOrCancelCommand(trimmedMessage)) {
    return true;
  }
  if (trimmedMessage.toLowerCase().startsWith("/addnote")) {
    return !mightBeSafetyCritical(trimmedMessage);
  }
  if (extractTicketCode(trimmedMessage)) {
    return !mightBeSafetyCritical(trimmedMessage);
  }
  return false;
}

function hardGuardRoute({
  session,
  trimmedMessage
}: {
  session: ChatSession;
  trimmedMessage: string;
}): ResolvedRoute | null {
  const menuMessage = normalizeMenuMessage(trimmedMessage);

  if (menuMessage === "อัปโหลดบทเรียน") {
    return {
      guideAction: "UPLOAD_STUDY_MATERIAL",
      intent: "GENERAL_CHAT",
      needsWebSearch: false,
      routerConfidence: 1,
      routerReason: "Greeting menu upload guide",
      routerType: "hard_guard",
      selectedTarget: "general_chat"
    };
  }

  if (menuMessage === "ถามข้อมูล bu" || menuMessage === "ถามข้อมูลทั่วไป") {
    return {
      guideAction: "ASK_BU_INFO_GUIDE",
      intent: "GENERAL_CHAT",
      needsWebSearch: false,
      routerConfidence: 1,
      routerReason: "Greeting menu BU info guide",
      routerType: "hard_guard",
      selectedTarget: "general_chat"
    };
  }

  if (menuMessage === "แจ้งปัญหาห้องเรียน") {
    return {
      guideAction: "REPORT_ISSUE_GUIDE",
      intent: "GENERAL_CHAT",
      needsWebSearch: false,
      routerConfidence: 1,
      routerReason: "Greeting menu issue report guide",
      routerType: "hard_guard",
      selectedTarget: "general_chat"
    };
  }

  if (menuMessage === "งานที่ต้องส่งมีอะไรบ้าง") {
    return {
      intent: "LIST_ASSIGNMENTS",
      needsWebSearch: false,
      routerConfidence: 1,
      routerReason: "Greeting menu assignments shortcut",
      routerType: "hard_guard",
      selectedTarget: "study_memory"
    };
  }

  if (menuMessage === "ดูบันทึกโน้ต") {
    return {
      intent: "LIST_NOTEBOOKS",
      needsWebSearch: false,
      routerConfidence: 1,
      routerReason: "Rich menu saved notes shortcut",
      routerType: "hard_guard",
      selectedTarget: "study_memory"
    };
  }

  if (menuMessage === "ถามจากบทเรียนนี้") {
    return {
      guideAction: "ASK_LATEST_STUDY_GUIDE",
      intent: "GENERAL_CHAT",
      needsWebSearch: false,
      routerConfidence: 1,
      routerReason: "Study pack ask latest guide",
      routerType: "hard_guard",
      selectedTarget: "general_chat"
    };
  }

  if (isResetOrCancelCommand(trimmedMessage)) {
    return {
      intent: "GENERAL_CHAT",
      needsWebSearch: false,
      resetRequested: true,
      routerConfidence: 1,
      routerReason: "Reset/cancel hard guard",
      routerType: "hard_guard",
      selectedTarget: "general_chat"
    };
  }

  if (session.state === "CREATING_TICKET") {
    return {
      intent: "CREATE_TICKET",
      needsWebSearch: false,
      routerConfidence: 1,
      routerReason: "Continuing deterministic ticket creation state",
      routerType: "hard_guard",
      selectedTarget: "ticket"
    };
  }

  if (trimmedMessage.toLowerCase().startsWith("/addnote")) {
    return {
      intent: "ADD_STUDY_NOTE",
      needsWebSearch: false,
      routerConfidence: 1,
      routerReason: "/addnote hard guard",
      routerType: "hard_guard",
      selectedTarget: "study_memory"
    };
  }

  if (extractTicketCode(trimmedMessage)) {
    return {
      intent: "CHECK_TICKET_STATUS",
      needsWebSearch: false,
      routerConfidence: 1,
      routerReason: "Ticket code hard guard",
      routerType: "hard_guard",
      selectedTarget: "ticket"
    };
  }

  return null;
}

export async function resolveRoute({
  history,
  session,
  trimmedMessage
}: {
  history: Array<{ content: string; role: "assistant" | "user" }>;
  session: ChatSession;
  trimmedMessage: string;
}): Promise<ResolvedRoute> {
  const guarded = hardGuardRoute({ session, trimmedMessage });
  if (guarded && (guarded.selectedTarget !== "ticket" || !mightBeSafetyCritical(trimmedMessage))) {
    return guarded;
  }

  const decision = await classifyWithAgentRouter(trimmedMessage, {
    sessionState: session.state,
    history: history.slice(-2)
  });

  // Keep deterministic ticket behavior unless the response needs urgent safety guidance.
  if (guarded && !decision.safetyCritical) {
    return { ...guarded, usage: decision.usage, usageEntries: decision.usageEntries, model: decision.model };
  }

  return {
    intent: decision.intent,
    needsWebSearch: decision.needsWebSearch,
    routerConfidence: decision.confidence,
    routerReason: decision.reason,
    routerType: decision.routerType,
    selectedTarget: decision.selectedTarget,
    safetyCritical: decision.safetyCritical,
    usage: decision.usage,
    usageEntries: decision.usageEntries,
    model: decision.model
  };
}
