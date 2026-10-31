import {
  generateGeneralChatReply,
  isAiConfigured,
  type AnswerSource
} from "@/lib/ai";
import {
  classifyWithAgentRouter,
  type AgentRouterDecision,
  type RouteTarget
} from "@/lib/agent-router";
import {
  chatLogRepository,
  type ChatLogRepository,
  type ChatChannel
} from "@/src/repositories/chat-log.repository";
import { answerFreshInfoFromVerifiedSources, type BuLinksLookupFn, type FreshInfoAnswer } from "@/lib/fresh-info";
import {
  knowledgeService,
  type KnowledgeService
} from "@/src/services/knowledge.service";
import { extractTicketCode, type Intent } from "@/lib/intent";
import {
  studyMemoryService,
  type StudyMemoryService,
  type SavedStudyNote
} from "@/src/services/study-memory.service";
import {
  lineFlexPresenter,
  type LineFlexPresenter
} from "@/src/presenters/line-flex.presenter";
import {
  ticketService,
  type TicketService
} from "@/src/services/ticket.service";
import {
  tokenUsageRepository,
  type TokenUsageRepository
} from "@/src/repositories/token-usage.repository";
import type { ChatSession } from "@/lib/types";
import { formatOutOfScopeReply } from "@/src/presenters/chat-policy.presenter";
import type { ExecutionLogEntry } from "@/src/dtos/playground.dto";
export type { ExecutionLogEntry } from "@/src/dtos/playground.dto";

export type BotReplyStreamCallbacks = {
  onTextDelta?: (delta: string) => void;
  onTextReplace?: (text: string, sources?: AnswerSource[]) => void;
  onTextReset?: () => void;
};

export type BotReplyInput = {
  channel?: ChatChannel;
  lineUserId: string;
  message: string;
  stream?: BotReplyStreamCallbacks;
};

export type BotReply = {
  runId?: string;
  sources?: AnswerSource[];
  text: string;
  flexMessage?: any;
  usedWebSearch?: boolean;
  usage?: { total_tokens: number };
  model?: string;
  executionLog?: ExecutionLogEntry[];
};

type RouterType = AgentRouterDecision["routerType"] | "hard_guard";

type ResolvedRoute = {
  guideAction?:
    | "UPLOAD_STUDY_MATERIAL"
    | "ASK_BU_INFO_GUIDE"
    | "REPORT_ISSUE_GUIDE"
    | "ASK_LATEST_STUDY_GUIDE";
  intent: Intent;
  needsWebSearch: boolean;
  resetRequested?: boolean;
  routerConfidence: number;
  routerReason: string;
  routerType: RouterType;
  selectedTarget: RouteTarget;
  safetyCritical?: boolean;
  usage?: { total_tokens: number };
  model?: string;
};

const safetyCriticalHintPattern =
  /(ทำร้ายตัวเอง|ฆ่าตัวตาย|ไม่อยากมีชีวิต|ไม่อยากอยู่แล้ว|อยากตาย|จบชีวิต|กรีดข้อมือ|กินยาเกินขนาด|กระโดดตึก|ไฟไหม้|เพลิงไหม้|ระเบิด|ถูกทำร้าย|มีคนถือมีด|มีปืน|อันตรายถึงชีวิต|ช่วยชีวิต|หมดสติ|เลือดออกมาก|หายใจไม่ออก|hurt\s+myself|kill\s+myself|end\s+my\s+life|suicid|self[- ]?harm|overdose|immediate\s+danger|on\s+fire|bomb|gunman|stabbing|bleeding\s+heavily|unconscious)/i;

export function mightBeSafetyCritical(message: string): boolean {
  return safetyCriticalHintPattern.test(message);
}

function needsRawChatHistory(intent: Intent) {
  return intent === "ASK_BU_INFO" || intent === "ASK_FRESH_INFO";
}

function parseAddNoteCommand(message: string) {
  const body = message.replace(/^\/addnote/i, "").trim();
  const [firstLine, ...restLines] = body.split(/\r?\n/);
  const courseName = firstLine?.trim();
  const rawText = restLines.join("\n").trim();

  if (!courseName || !rawText) {
    return null;
  }

  return { courseName, rawText };
}

function formatSavedStudyNoteReply(note: SavedStudyNote, isThai: boolean) {
  const lines = isThai
    ? [`สรุปบทเรียนให้แล้วครับ`, `วิชา: ${note.courseName}`]
    : [`Your study pack is ready.`, `Course: ${note.courseName}`];

  if (note.keyPoints.length > 0) {
    lines.push(isThai ? "หัวข้อหลัก:" : "Key topics:");
    lines.push(...note.keyPoints.slice(0, 5).map((point) => `- ${point}`));
  }

  if (note.summary) {
    lines.push(isThai ? `จำง่าย ๆ: ${note.summary}` : `Easy summary: ${note.summary}`);
  }

  if (note.assignments.length > 0) {
    lines.push(isThai ? "งานที่พบ:" : "Assignments found:");
    for (const assignment of note.assignments) {
      lines.push(`- ${assignment.title}`);
      if (assignment.dueDateText) {
        lines.push(isThai ? `  กำหนดส่ง: ${assignment.dueDateText}` : `  Due: ${assignment.dueDateText}`);
      }
    }
  }

  lines.push(
    isThai
      ? "เลือกปุ่มใน Study Pack เพื่อให้ช่วยติวต่อได้เลยครับ"
      : "Use the Study Pack buttons if you want me to tutor you from this material."
  );

  return lines.join("\n");
}

function formatAssignmentsReply(
  assignments: Array<{
    courseName: string;
    title: string;
    description: string | null;
    dueDateText: string | null;
    dueAt: Date | null;
  }>,
  isThai: boolean
) {
  if (assignments.length === 0) {
    return isThai ? "ยังไม่พบ assignment ในโน้ตที่บันทึกไว้ครับ" : "No assignments found in your saved notes.";
  }

  return assignments
    .map((assignment) => {
      const lines = [`${assignment.courseName}: ${assignment.title}`];
      if (assignment.dueDateText || assignment.dueAt) {
        const dueDate = assignment.dueDateText ?? assignment.dueAt?.toISOString();
        lines.push(isThai ? `กำหนดส่ง: ${dueDate}` : `Due: ${dueDate}`);
      }
      if (assignment.description) {
        lines.push(isThai ? `รายละเอียด: ${assignment.description}` : `Details: ${assignment.description}`);
      }
      return lines.join("\n");
    })
    .join("\n\n");
}

function didUseStudyMemory(intent: Intent) {
  return ["ADD_STUDY_NOTE", "ASK_STUDY_MEMORY", "LIST_ASSIGNMENTS", "LIST_NOTEBOOKS", "VIEW_NOTEBOOK"].includes(intent);
}

function didUseTicketFlow(intent: Intent) {
  return ["CHECK_TICKET_STATUS", "CREATE_TICKET"].includes(intent);
}

function mightUseOpenAI(route: ResolvedRoute, usedWebSearch: boolean) {
  if (!isAiConfigured()) {
    return false;
  }

  if (route.routerType === "agent_router" || route.usage) {
    return true;
  }

  if (usedWebSearch) {
    return true;
  }

  return ["ADD_STUDY_NOTE", "ASK_BU_INFO", "ASK_STUDY_MEMORY", "GENERAL_CHAT", "UNKNOWN"].includes(
    route.intent
  );
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

function asReply(
  text: string,
  sources?: AnswerSource[],
  usage?: {
    total_tokens: number;
    prompt_tokens?: number;
    completion_tokens?: number;
    cached_tokens?: number;
  },
  model?: string,
  flexMessage?: any,
  executionLog?: ExecutionLogEntry[]
): BotReply {
  return { text, sources, usage, model, flexMessage, executionLog };
}

export class ChatOrchestrationService {
  constructor(
    private chatLogRepo: ChatLogRepository = chatLogRepository,
    private ticketSvc: TicketService = ticketService,
    private studySvc: StudyMemoryService = studyMemoryService,
    private knowledgeSvc: KnowledgeService = knowledgeService,
    private flexPresenter: LineFlexPresenter = lineFlexPresenter,
    private buLinksLookup?: BuLinksLookupFn,
    private tokenUsageRepo: TokenUsageRepository = tokenUsageRepository
  ) {}

  private freshInfoLogEntry(reply: FreshInfoAnswer, started: number): ExecutionLogEntry {
    const timing = { status: "applied" as const, durationMs: Math.round(performance.now() - started) };
    return reply.origin === "bulinks"
      ? { action: "BU Links Lookup", ...timing, details: reply.links?.map((link) => link.url).join(", ") }
      : { action: "Search Fresh Info (Web Search)", ...timing, details: reply.model ? `Model: ${reply.model}` : undefined };
  }

  private canResolveWithoutRouter(trimmedMessage: string): boolean {
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

  private hardGuardRoute({
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

  private async resolveRoute({
    history,
    session,
    trimmedMessage
  }: {
    history: Array<{ content: string; role: "assistant" | "user" }>;
    session: ChatSession;
    trimmedMessage: string;
  }): Promise<ResolvedRoute> {
    const guarded = this.hardGuardRoute({ session, trimmedMessage });
    if (guarded && (guarded.selectedTarget !== "ticket" || !mightBeSafetyCritical(trimmedMessage))) {
      return guarded;
    }

    const decision = await classifyWithAgentRouter(trimmedMessage, {
      sessionState: session.state,
      history: history.slice(-2)
    });

    // Keep deterministic ticket behavior unless the response needs urgent safety guidance.
    if (guarded && !decision.safetyCritical) {
      return { ...guarded, usage: decision.usage, model: decision.model };
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
      model: decision.model
    };
  }

  private async executeBotReply({
    history,
    lineUserId,
    route,
    routerMs,
    session,
    stream,
    trimmedMessage
  }: {
    history: Array<{ content: string; role: "assistant" | "user" }>;
    lineUserId: string;
    route: ResolvedRoute;
    routerMs: number;
    session: ChatSession;
    stream?: BotReplyStreamCallbacks;
    trimmedMessage: string;
  }): Promise<BotReply> {
    const { intent } = route;
    let reply: BotReply;
    let streamedText = "";
    const onTextDelta = stream?.onTextDelta
      ? (delta: string) => {
          streamedText += delta;
          stream.onTextDelta?.(delta);
        }
      : undefined;
    const onTextReset = stream?.onTextReset
      ? () => {
          streamedText = "";
          stream.onTextReset?.();
        }
      : undefined;
    const streamHooks = onTextDelta ? { onTextDelta, onTextReset } : undefined;

    const routerModel = route.model;
    const executionLog: ExecutionLogEntry[] = [
      {
        action: "Agent Router Decision",
        status: route.routerType === "agent_router" || route.routerType === "hard_guard" ? "applied" : "fallback",
        durationMs: routerMs,
        details: `Intent: ${route.intent}, Target: ${route.selectedTarget}${routerModel ? ` · Model: ${routerModel}` : ""}`
      }
    ];

    const isThai = /[\u0E00-\u0E7F]/.test(trimmedMessage);

    if (route.guideAction === "UPLOAD_STUDY_MATERIAL") {
      executionLog.push({ action: "Greeting Menu Guide", details: "Upload study material" });
      reply = asReply(
        "บันทึกบทเรียนได้ 2 วิธีครับ\n\n1. แนบไฟล์ PDF หรือ DOCX มาในแชตนี้ได้เลย\n\n2. พิมพ์โน้ตเป็นข้อความด้วยรูปแบบนี้:\n/addnote <ชื่อวิชา>\n<เนื้อหาที่เรียนหรืองานที่ต้องส่ง>\n\nตัวอย่าง:\n/addnote Marketing\nToday we learned customer segmentation.\nAssignment due Friday: create one customer persona.",
        undefined,
        undefined,
        undefined,
        undefined,
        executionLog
      );
    } else if (route.guideAction === "ASK_BU_INFO_GUIDE") {
      executionLog.push({ action: "Greeting Menu Guide", details: "Ask BU info" });
      reply = asReply(
        "พิมพ์คำถามเกี่ยวกับ BU มาได้เลยครับ\n\nตัวอย่าง:\n- BU Wi-Fi ใช้ยังไง\n- ดูวันหยุดมหาวิทยาลัยที่ไหน\n- ติดต่อหน่วยงานไหนได้บ้าง",
        undefined,
        undefined,
        undefined,
        undefined,
        executionLog
      );
    } else if (route.guideAction === "REPORT_ISSUE_GUIDE") {
      executionLog.push({ action: "Greeting Menu Guide", details: "Report classroom issue" });
      reply = asReply(
        "แจ้งอาคาร ห้อง และรายละเอียดปัญหาได้เลยครับ\n\nตัวอย่าง:\nอาคาร A3 ชั้น 2 ห้อง LAB 2 แอร์ไม่เย็น",
        undefined,
        undefined,
        undefined,
        undefined,
        executionLog
      );
    } else if (route.guideAction === "ASK_LATEST_STUDY_GUIDE") {
      executionLog.push({ action: "Study Pack Guide", details: "Ask from latest lesson" });
      reply = asReply(
        "พิมพ์คำถามเกี่ยวกับบทเรียนล่าสุดได้เลยครับ\n\nตัวอย่าง:\n- อธิบายหัวข้อนี้ให้ง่ายขึ้น\n- จุดไหนสำคัญสุด\n- ออกข้อสอบจากบทเรียนนี้ให้หน่อย",
        undefined,
        undefined,
        undefined,
        undefined,
        executionLog
      );
    } else if (route.resetRequested) {
      executionLog.push({ action: "Reset Ticket Flow" });
      await this.ticketSvc.resetTicketFlow(lineUserId);
      reply = asReply(
        isThai
          ? "รีเซ็ตบทสนทนาเรียบร้อยครับ พิมพ์เรื่องใหม่ที่ต้องการให้ช่วยได้เลยครับ"
          : "Conversation reset. How can I help you?",
        undefined,
        undefined,
        undefined,
        undefined,
        executionLog
      );
    } else if (intent === "ADD_STUDY_NOTE") {
      const parsed = parseAddNoteCommand(trimmedMessage);
      if (!parsed) {
        executionLog.push({ action: "Parse Add Note Command", details: "Failed to parse" });
        reply = asReply(
          isThai
            ? "ใช้รูปแบบนี้ครับ:\n/addnote <ชื่อวิชา>\n<เนื้อหาโน้ตหรือเลคเชอร์>"
            : "Please use this format:\n/addnote <Course Name>\n<Note content>",
          undefined,
          undefined,
          undefined,
          undefined,
          executionLog
        );
      } else {
        executionLog.push({ action: "Save Study Note", details: `Course: ${parsed.courseName}` });
        const note = await this.studySvc.saveStudyNote(lineUserId, parsed.courseName, parsed.rawText);
        reply = asReply(
          formatSavedStudyNoteReply(note, isThai),
          undefined,
          undefined,
          undefined,
          this.flexPresenter.createStudyNoteFlex(note),
          executionLog
        );
      }
    } else if (intent === "LIST_ASSIGNMENTS") {
      executionLog.push({ action: "Find Course Name" });
      const courseName = await this.studySvc.findCourseNameInMessage(lineUserId, trimmedMessage);
      executionLog.push({
        action: "Get Assignments",
        details: courseName ? `Course: ${courseName}` : "All courses"
      });
      const assignments = await this.studySvc.getAssignments(lineUserId, courseName);
      reply = asReply(
        formatAssignmentsReply(assignments, isThai),
        undefined,
        undefined,
        undefined,
        this.flexPresenter.createAssignmentsFlex(assignments),
        executionLog
      );
    } else if (intent === "LIST_NOTEBOOKS") {
      executionLog.push({ action: "List Notebooks" });
      const notebookReply = await this.studySvc.listNotebooks(
        lineUserId,
        isThai,
        executionLog
      );
      reply = asReply(
        notebookReply.text,
        undefined,
        undefined,
        undefined,
        undefined,
        executionLog
      );
    } else if (intent === "VIEW_NOTEBOOK") {
      executionLog.push({ action: "View Notebook" });
      const notebookReply = await this.studySvc.viewNotebook(
        lineUserId,
        trimmedMessage,
        isThai,
        executionLog
      );
      reply = asReply(
        notebookReply.text,
        undefined,
        undefined,
        undefined,
        undefined,
        executionLog
      );
    } else if (intent === "ASK_STUDY_MEMORY") {
      executionLog.push({ action: "Search Study Memory" });
      const memoryReply = await this.studySvc.answerFromStudyMemory(
        lineUserId,
        trimmedMessage,
        isThai,
        executionLog,
        onTextDelta
      );
      reply = asReply(
        memoryReply.text,
        undefined,
        undefined,
        undefined,
        memoryReply.flexMessage,
        executionLog
      );
    } else if (intent === "ASK_FRESH_INFO") {
      const freshStarted = performance.now();
      const fresh = await answerFreshInfoFromVerifiedSources(trimmedMessage, history, this.buLinksLookup, streamHooks);
      reply = fresh;
      executionLog.push(this.freshInfoLogEntry(fresh, freshStarted));
      reply.executionLog = executionLog;
    } else if (intent === "ASK_BU_INFO") {
      const knowledgeAnswer = await this.knowledgeSvc.answerQuestion(trimmedMessage, history, streamHooks);
      executionLog.push(...(knowledgeAnswer.trace ?? []));
      if (knowledgeAnswer.isMiss) {
        executionLog.push({ action: "Knowledge Base Miss - Falling back to Web Search" });
        const freshStarted = performance.now();
        const fresh = await answerFreshInfoFromVerifiedSources(trimmedMessage, history, this.buLinksLookup, streamHooks);
        reply = fresh;
        executionLog.push(this.freshInfoLogEntry(fresh, freshStarted));
        if (knowledgeAnswer.usage && reply.usage) {
          reply.usage.total_tokens += knowledgeAnswer.usage.total_tokens;
        } else if (knowledgeAnswer.usage) {
          reply.usage = knowledgeAnswer.usage;
        }
      } else {
        reply = asReply(
          knowledgeAnswer.text,
          knowledgeAnswer.sources,
          knowledgeAnswer.usage,
          knowledgeAnswer.model,
          undefined,
          executionLog
        );
      }
      if (!reply.executionLog) reply.executionLog = executionLog;
    } else if (intent === "CREATE_TICKET") {
      executionLog.push({ action: "Continue Ticket Flow" });
      const ticketReply = await this.ticketSvc.continueTicketFlow({
        lineUserId,
        message: trimmedMessage,
        session
      });
      reply = asReply(
        ticketReply.text,
        undefined,
        undefined,
        undefined,
        ticketReply.flexMessage,
        executionLog
      );
    } else if (intent === "CHECK_TICKET_STATUS") {
      executionLog.push({ action: "Check Ticket Status" });
      const ticketCode = extractTicketCode(trimmedMessage);
      if (!ticketCode) {
        executionLog.push({ action: "Parse Ticket Code", details: "Missing ticket code" });
        reply = asReply(
          "ขอรหัส Ticket ด้วยครับ เช่น เช็ค ticket BU-TICKET-0001",
          undefined,
          undefined,
          undefined,
          undefined,
          executionLog
        );
      } else {
        executionLog.push({ action: "Get Ticket by Code", details: `Code: ${ticketCode}` });
        const ticket = await this.ticketSvc.getTicketByCode(ticketCode);
        reply = asReply(
          ticket ? this.ticketSvc.formatTicketStatusReply(ticket) : `ยังไม่พบ Ticket: ${ticketCode} ครับ`,
          undefined,
          undefined,
          undefined,
          undefined,
          executionLog
        );
      }
    } else if (intent === "OUT_OF_SCOPE") {
      executionLog.push({ action: "Out-of-scope Boundary Reply" });
      reply = asReply(
        formatOutOfScopeReply(trimmedMessage),
        undefined,
        undefined,
        undefined,
        undefined,
        executionLog
      );
    } else {
      const actionName = intent === "UNKNOWN" ? "Generate Clarification Question (OpenAI)" : "Generate General Chat Reply (OpenAI)";
      const chatStarted = performance.now();
      const aiResponse = await generateGeneralChatReply(trimmedMessage, history, {
        onTextDelta,
        policy: intent === "UNKNOWN" ? "clarification" : "general",
        safetyCritical: route.safetyCritical
      });
      executionLog.push({
        action: actionName,
        status: "applied",
        durationMs: Math.round(performance.now() - chatStarted),
        details: aiResponse.model ? `Model: ${aiResponse.model}` : undefined
      });
      reply = asReply(
        aiResponse.text,
        undefined,
        aiResponse.usage,
        aiResponse.model,
        undefined,
        executionLog
      );
    }

    const outputStarted = performance.now();
    if (reply.sources && reply.sources.length > 0) {
      const uniqueSources = Array.from(new Set(reply.sources.map((s) => s.url)));
      const sourcesList = uniqueSources.map((url) => `- ${url}`).join("\n");
      reply.text += "\n\nแหล่งข้อมูล:\n" + sourcesList;
    }

    executionLog.push({ action: "Output", durationMs: Math.round(performance.now() - outputStarted),
      status: "applied", details: `เตรียมคำตอบพร้อม ${reply.sources?.length ?? 0} citations` });

    if (stream) {
      if (!streamedText) {
        stream.onTextDelta?.(reply.text);
        if (reply.sources?.length) {
          stream.onTextReplace?.(reply.text, reply.sources);
        }
      } else if (streamedText !== reply.text || (reply.sources?.length ?? 0) > 0) {
        if (reply.text.startsWith(streamedText) && !(reply.sources?.length)) {
          const suffix = reply.text.slice(streamedText.length);
          if (suffix) stream.onTextDelta?.(suffix);
        } else {
          stream.onTextReplace?.(reply.text, reply.sources);
        }
      }
    }

    return reply;
  }

  async createBotReply({
    channel = "line",
    lineUserId,
    message,
    stream
  }: BotReplyInput): Promise<BotReply> {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      const promptReply = "พิมพ์คำถามหรือรายละเอียดที่ต้องการให้ StudyMate ช่วยได้เลยครับ";
      stream?.onTextDelta?.(promptReply);
      return asReply(promptReply);
    }

    const startedAt = Date.now();
    const skipCompletedHistory = this.canResolveWithoutRouter(trimmedMessage);
    const [session, completedHistory] = await Promise.all([
      this.ticketSvc.getOrCreateChatSession(lineUserId),
      skipCompletedHistory
        ? Promise.resolve([] as Array<{ content: string; role: "assistant" | "user" }>)
        : this.chatLogRepo.getRecentCompletedChatHistory(lineUserId, 4)
    ]);

    const routeStarted = performance.now();
    const route = await this.resolveRoute({ history: completedHistory, session, trimmedMessage });
    const routerMs = Math.round(performance.now() - routeStarted);
    const intent = route.intent;
    const userMessageId = crypto.randomUUID();

    const [history, , run] = await Promise.all([
      route.guideAction || route.resetRequested
        ? Promise.resolve([] as Array<{ content: string; role: "assistant" | "user" }>)
        : intent === "GENERAL_CHAT" || intent === "UNKNOWN"
          ? Promise.resolve(completedHistory)
          : needsRawChatHistory(intent)
            ? this.chatLogRepo.getRecentChatHistory(lineUserId, 8, userMessageId)
            : Promise.resolve([] as Array<{ content: string; role: "assistant" | "user" }>),
      this.chatLogRepo.createChatMessage({
        id: userMessageId,
        channel,
        content: trimmedMessage,
        intent,
        lineUserId,
        metadata: {
          messageLength: trimmedMessage.length,
          needsWebSearch: route.needsWebSearch,
          routerConfidence: route.routerConfidence,
          routerReason: route.routerReason,
          routerType: route.routerType,
          selectedTarget: route.selectedTarget,
          safetyCritical: Boolean(route.safetyCritical),
          sessionState: session.state
        },
        role: "user",
        sessionId: session.id
      }),
      this.chatLogRepo.createBotRun({
        intent,
        lineUserId,
        metadata: {
          channel,
          needsWebSearch: route.needsWebSearch,
          routerConfidence: route.routerConfidence,
          routerReason: route.routerReason,
          routerType: route.routerType,
          selectedTarget: route.selectedTarget,
          safetyCritical: Boolean(route.safetyCritical),
          sessionState: session.state
        },
        userMessageId
      })
    ]);

    try {
      const reply = await this.executeBotReply({
        history,
        lineUserId,
        route,
        routerMs,
        session,
        stream,
        trimmedMessage
      });

      const assistantMessageId = crypto.randomUUID();
      const totalTokens = (route.usage?.total_tokens ?? 0) + (reply.usage?.total_tokens ?? 0);
      const finalModel = reply.model || route.model;

      await Promise.all([
        this.chatLogRepo.createChatMessage({
          id: assistantMessageId,
          channel,
          content: reply.text,
          intent,
          lineUserId,
          metadata: {
            replyLength: reply.text.length,
            sourceCount: reply.sources?.length ?? 0,
            sourceUrls: reply.sources?.map((source) => source.url) ?? [],
            usedWebSearch: Boolean(reply.usedWebSearch)
          },
          role: "assistant",
          sessionId: session.id
        }),
        this.chatLogRepo.updateBotRun(run!.id, {
          assistantMessageId,
          latencyMs: Date.now() - startedAt,
          metadata: {
            channel,
            needsWebSearch: route.needsWebSearch,
            routerConfidence: route.routerConfidence,
            routerReason: route.routerReason,
            routerType: route.routerType,
            routerModel: route.model,
            responseModel: reply.model,
            selectedTarget: route.selectedTarget,
            safetyCritical: Boolean(route.safetyCritical),
            replyLength: reply.text.length,
            sourceCount: reply.sources?.length ?? 0,
            tokensUsed: totalTokens > 0 ? totalTokens : undefined,
            sourceUrls: reply.sources?.map((source) => source.url) ?? [],
            modelName: finalModel,
            sessionState: session.state,
            executionLog: reply.executionLog
          },
          status: "success",
          usedOpenAI: mightUseOpenAI(route, Boolean(reply.usedWebSearch)),
          usedStudyMemory: didUseStudyMemory(intent),
          usedTicketFlow: didUseTicketFlow(intent),
          usedWebSearch: Boolean(reply.usedWebSearch)
        })
      ]);

      const tokenLogs = [];
      const routeUsage = route.usage as { total_tokens: number; prompt_tokens?: number; completion_tokens?: number; cached_tokens?: number } | undefined;
      if (routeUsage && routeUsage.total_tokens > 0) {
        tokenLogs.push({
          botRunId: run!.id,
          provider: "openai",
          model: route.model || "gpt-4o-mini",
          step: "router",
          promptTokens: routeUsage.prompt_tokens,
          completionTokens: routeUsage.completion_tokens,
          cachedTokens: routeUsage.cached_tokens,
          totalTokens: routeUsage.total_tokens
        });
      }
      const replyUsage = reply.usage as { total_tokens: number; prompt_tokens?: number; completion_tokens?: number; cached_tokens?: number } | undefined;
      if (replyUsage && replyUsage.total_tokens > 0) {
        tokenLogs.push({
          botRunId: run!.id,
          provider: "openai",
          model: reply.model || finalModel || "gpt-4o-mini",
          step: "answer",
          promptTokens: replyUsage.prompt_tokens,
          completionTokens: replyUsage.completion_tokens,
          cachedTokens: replyUsage.cached_tokens,
          totalTokens: replyUsage.total_tokens
        });
      }
      if (tokenLogs.length > 0) {
        this.tokenUsageRepo.recordUsages(tokenLogs).catch((err) => {
          console.error("Failed to record token usage logs:", err);
        });
      }

      return { ...reply, runId: run!.id };
    } catch (error) {
      if (run?.id) {
        if (route.usage && route.usage.total_tokens > 0) {
          const routeUsage = route.usage as { total_tokens: number; prompt_tokens?: number; completion_tokens?: number; cached_tokens?: number };
          this.tokenUsageRepo.recordUsage({
            botRunId: run.id,
            provider: "openai",
            model: route.model || "gpt-4o-mini",
            step: "router",
            promptTokens: routeUsage.prompt_tokens,
            completionTokens: routeUsage.completion_tokens,
            cachedTokens: routeUsage.cached_tokens,
            totalTokens: routeUsage.total_tokens
          }).catch(() => {});
        }
        await this.chatLogRepo.updateBotRun(run.id, {
          errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
          latencyMs: Date.now() - startedAt,
          metadata: {
            channel,
            needsWebSearch: route.needsWebSearch,
            routerConfidence: route.routerConfidence,
            routerReason: route.routerReason,
            routerType: route.routerType,
            selectedTarget: route.selectedTarget,
            sessionState: session.state,
            executionLog: route.intent
              ? [
                  {
                    action: "Error",
                    details: error instanceof Error ? error.message : "Unknown error"
                  }
                ]
              : undefined
          },
          status: "error",
          usedOpenAI: mightUseOpenAI(route, false),
          usedStudyMemory: didUseStudyMemory(intent),
          usedTicketFlow: didUseTicketFlow(intent),
          usedWebSearch: false
        });
      }

      throw error;
    }
  }
}

export const chatOrchestrationService = new ChatOrchestrationService();
