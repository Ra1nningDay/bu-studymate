import {
  generateGeneralChatReply,
  isAiConfigured,
  type AnswerSource
} from "@/lib/ai";
import {
  classifyWithAgentRouter,
  type AgentRouterDecision,
  type AgentRouterIntent,
  type RouteTarget
} from "@/lib/agent-router";
import {
  createBotRunLog,
  createChatMessageLog,
  getRecentChatHistory,
  updateBotRunLog,
  type ChatChannel,
  type ChatHistoryMessage
} from "@/lib/chat-logs";
import { answerFreshInfoFromVerifiedSources } from "@/lib/fresh-info";
import { answerKnowledgeQuestion } from "@/lib/knowledge";
import { extractTicketCode, type Intent } from "@/lib/intent";
import {
  answerFromStudyMemory,
  findCourseNameInMessage,
  getAssignments,
  saveStudyNote
} from "@/lib/study-memory";
import {
  createStudyNoteFlex,
  createAssignmentsFlex
} from "@/lib/flex-messages";
import {
  continueTicketFlow,
  formatTicketStatusReply,
  getOrCreateChatSession,
  getTicketByCode,
  resetTicketFlow
} from "@/lib/ticket";

export type BotReplyInput = {
  channel?: ChatChannel;
  lineUserId: string;
  message: string;
};

export type ExecutionLogEntry = {
  action: string;
  details?: string;
};

export type BotReply = {
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
  guideAction?: "UPLOAD_STUDY_MATERIAL" | "ASK_BU_INFO_GUIDE" | "REPORT_ISSUE_GUIDE" | "ASK_LATEST_STUDY_GUIDE";
  intent: Intent;
  needsWebSearch: boolean;
  resetRequested?: boolean;
  routerConfidence: number;
  routerReason: string;
  routerType: RouterType;
  selectedTarget: RouteTarget;
  usage?: { total_tokens: number };
  model?: string;
};



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

function formatSavedStudyNoteReply(note: Awaited<ReturnType<typeof saveStudyNote>>, isThai: boolean) {
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

function formatAssignmentsReply(assignments: Awaited<ReturnType<typeof getAssignments>>, isThai: boolean) {
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
  return ["ADD_STUDY_NOTE", "ASK_STUDY_MEMORY", "LIST_ASSIGNMENTS"].includes(intent);
}

function didUseTicketFlow(intent: Intent) {
  return ["CHECK_TICKET_STATUS", "CREATE_TICKET"].includes(intent);
}

function mightUseOpenAI(route: ResolvedRoute, usedWebSearch: boolean) {
  if (!isAiConfigured()) {
    return false;
  }

  if (route.routerType === "agent_router") {
    return true;
  }

  if (usedWebSearch) {
    return true;
  }

  return ["ADD_STUDY_NOTE", "ASK_BU_INFO", "ASK_STUDY_MEMORY", "GENERAL_CHAT"].includes(
    route.intent
  );
}

async function answerFreshQuestion(
  message: string,
  history?: ChatHistoryMessage[]
) {
  return answerFreshInfoFromVerifiedSources(message, history);
}

function isResetOrCancelCommand(message: string) {
  return /^(\/reset|cancel|ยกเลิก)$/i.test(message.trim());
}

function normalizeMenuMessage(message: string) {
  return message.replace(/\s+/g, " ").trim().toLowerCase();
}

function hardGuardRoute({
  session,
  trimmedMessage
}: {
  session: Awaited<ReturnType<typeof getOrCreateChatSession>>;
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

  if (menuMessage === "ถามข้อมูล bu") {
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

async function resolveRoute({
  session,
  trimmedMessage
}: {
  session: Awaited<ReturnType<typeof getOrCreateChatSession>>;
  trimmedMessage: string;
}): Promise<ResolvedRoute> {
  const guarded = hardGuardRoute({ session, trimmedMessage });
  if (guarded) {
    return guarded;
  }

  const decision = await classifyWithAgentRouter(trimmedMessage, {
    sessionState: session.state
  });

  return {
    intent: decision.intent,
    needsWebSearch: decision.needsWebSearch,
    routerConfidence: decision.confidence,
    routerReason: decision.reason,
    routerType: decision.routerType,
    selectedTarget: decision.selectedTarget,
    usage: decision.usage,
    model: decision.model
  };
}

function asReply(
  text: string,
  sources?: AnswerSource[],
  usage?: { total_tokens: number },
  model?: string,
  flexMessage?: any,
  executionLog?: ExecutionLogEntry[]
): BotReply {
  return { text, sources, usage, model, flexMessage, executionLog };
}

async function executeBotReply({
  history,
  lineUserId,
  route,
  session,
  trimmedMessage
}: {
  history: ChatHistoryMessage[];
  lineUserId: string;
  route: ResolvedRoute;
  session: Awaited<ReturnType<typeof getOrCreateChatSession>>;
  trimmedMessage: string;
}) {
  const { intent } = route;
  let reply: BotReply;
  const executionLog: ExecutionLogEntry[] = [
    {
      action: "Agent Router Decision",
      details: `Intent: ${route.intent}, Target: ${route.selectedTarget}`
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
    await resetTicketFlow(lineUserId);
    reply = asReply(isThai ? "รีเซ็ตบทสนทนาเรียบร้อยครับ พิมพ์เรื่องใหม่ที่ต้องการให้ช่วยได้เลยครับ" : "Conversation reset. How can I help you?", undefined, undefined, undefined, undefined, executionLog);
  } else if (intent === "ADD_STUDY_NOTE") {
    const parsed = parseAddNoteCommand(trimmedMessage);
    if (!parsed) {
      executionLog.push({ action: "Parse Add Note Command", details: "Failed to parse" });
      reply = asReply(isThai ? "ใช้รูปแบบนี้ครับ:\n/addnote <ชื่อวิชา>\n<เนื้อหาโน้ตหรือเลคเชอร์>" : "Please use this format:\n/addnote <Course Name>\n<Note content>", undefined, undefined, undefined, undefined, executionLog);
    } else {
      executionLog.push({ action: "Save Study Note", details: `Course: ${parsed.courseName}` });
      const note = await saveStudyNote(lineUserId, parsed.courseName, parsed.rawText);
      reply = asReply(formatSavedStudyNoteReply(note, isThai), undefined, undefined, undefined, createStudyNoteFlex(note), executionLog);
    }
  } else if (intent === "LIST_ASSIGNMENTS") {
    executionLog.push({ action: "Find Course Name" });
    const courseName = await findCourseNameInMessage(lineUserId, trimmedMessage);
    executionLog.push({ action: "Get Assignments", details: courseName ? `Course: ${courseName}` : "All courses" });
    const assignments = await getAssignments(lineUserId, courseName);
    reply = asReply(formatAssignmentsReply(assignments, isThai), undefined, undefined, undefined, createAssignmentsFlex(assignments), executionLog);
  } else if (intent === "ASK_STUDY_MEMORY") {
    executionLog.push({ action: "Search Study Memory" });
    const memoryReply = await answerFromStudyMemory(lineUserId, trimmedMessage, isThai, executionLog);
    reply = asReply(memoryReply.text, undefined, undefined, undefined, memoryReply.flexMessage, executionLog);
  } else if (intent === "ASK_FRESH_INFO") {
    executionLog.push({ action: "Search Fresh Info (Web Search)" });
    reply = await answerFreshQuestion(trimmedMessage, history);
    reply.executionLog = executionLog;
  } else if (intent === "ASK_BU_INFO") {
    executionLog.push({ action: "Search Knowledge Base" });
    const knowledgeAnswer = await answerKnowledgeQuestion(trimmedMessage, history);
    if (knowledgeAnswer.isMiss) {
      executionLog.push({ action: "Knowledge Base Miss - Falling back to Web Search" });
      reply = await answerFreshQuestion(trimmedMessage, history);
      // Aggregate usage if the knowledge base also used tokens
      if (knowledgeAnswer.usage && reply.usage) {
        reply.usage.total_tokens += knowledgeAnswer.usage.total_tokens;
      } else if (knowledgeAnswer.usage) {
        reply.usage = knowledgeAnswer.usage;
      }
    } else {
      reply = asReply(knowledgeAnswer.text, undefined, knowledgeAnswer.usage, knowledgeAnswer.model, undefined, executionLog);
    }
    if (!reply.executionLog) reply.executionLog = executionLog;
  } else if (intent === "CREATE_TICKET") {
    executionLog.push({ action: "Continue Ticket Flow" });
    const ticketReply = await continueTicketFlow({
      lineUserId,
      message: trimmedMessage,
      session
    });
    reply = asReply(
      ticketReply.text,
      undefined, undefined, undefined, ticketReply.flexMessage, executionLog
    );
  } else if (intent === "CHECK_TICKET_STATUS") {
    executionLog.push({ action: "Check Ticket Status" });
    const ticketCode = extractTicketCode(trimmedMessage);
    if (!ticketCode) {
      executionLog.push({ action: "Parse Ticket Code", details: "Missing ticket code" });
      reply = asReply("ขอรหัส Ticket ด้วยครับ เช่น เช็ค ticket BU-TICKET-0001", undefined, undefined, undefined, undefined, executionLog);
    } else {
      executionLog.push({ action: "Get Ticket by Code", details: `Code: ${ticketCode}` });
      const ticket = await getTicketByCode(ticketCode);
      reply = asReply(ticket ? formatTicketStatusReply(ticket) : `ยังไม่พบ Ticket: ${ticketCode} ครับ`, undefined, undefined, undefined, undefined, executionLog);
    }
  } else if (intent === "GENERAL_CHAT") {
    executionLog.push({ action: "Generate General Chat Reply (OpenAI)" });
    const aiResponse = await generateGeneralChatReply(trimmedMessage, history);
    reply = asReply(aiResponse.text, undefined, aiResponse.usage, aiResponse.model, undefined, executionLog);
  } else {
    executionLog.push({ action: "Fallback to General Chat (OpenAI)" });
    const aiResponse = await generateGeneralChatReply(trimmedMessage, history);
    reply = asReply(aiResponse.text, undefined, aiResponse.usage, aiResponse.model, undefined, executionLog);
  }

  // Append sources to the output message explicitly if they exist
  if (reply.sources && reply.sources.length > 0) {
    const uniqueSources = Array.from(new Set(reply.sources.map(s => s.url)));
    const sourcesList = uniqueSources.map(url => `- ${url}`).join("\n");
    reply.text += "\n\nแหล่งข้อมูล:\n" + sourcesList;
  }

  return reply;
}

export async function createBotReply({
  channel = "line",
  lineUserId,
  message
}: BotReplyInput) {
  const trimmedMessage = message.trim();
  if (!trimmedMessage) {
    return asReply("พิมพ์คำถามหรือรายละเอียดที่ต้องการให้ StudyMate ช่วยได้เลยครับ");
  }

  const startedAt = Date.now();
  const session = await getOrCreateChatSession(lineUserId);
  const route = await resolveRoute({ session, trimmedMessage });
  const history = await getRecentChatHistory(lineUserId);
  const intent = route.intent;
  const userMessage = await createChatMessageLog({
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
      sessionState: session.state
    },
    role: "user",
    sessionId: session.id
  });
  const run = await createBotRunLog({
    intent,
    lineUserId,
    metadata: {
      channel,
      needsWebSearch: route.needsWebSearch,
      routerConfidence: route.routerConfidence,
      routerReason: route.routerReason,
      routerType: route.routerType,
      selectedTarget: route.selectedTarget,
      sessionState: session.state
    },
    userMessageId: userMessage?.id
  });

  try {
    const reply = await executeBotReply({
      history,
      lineUserId,
      route,
      session,
      trimmedMessage
    });
    const assistantMessage = await createChatMessageLog({
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
    });

    const totalTokens = (route.usage?.total_tokens ?? 0) + (reply.usage?.total_tokens ?? 0);
    const finalModel = reply.model || route.model;

    await updateBotRunLog({
      assistantMessageId: assistantMessage?.id,
      latencyMs: Date.now() - startedAt,
      metadata: {
        channel,
        needsWebSearch: route.needsWebSearch,
        routerConfidence: route.routerConfidence,
        routerReason: route.routerReason,
        routerType: route.routerType,
        selectedTarget: route.selectedTarget,
        sourceCount: reply.sources?.length ?? 0,
        tokensUsed: totalTokens > 0 ? totalTokens : undefined,
        modelName: finalModel,
        executionLog: reply.executionLog
      },
      runId: run?.id,
      status: "success",
      usedOpenAI: mightUseOpenAI(route, Boolean(reply.usedWebSearch)),
      usedStudyMemory: didUseStudyMemory(intent),
      usedTicketFlow: didUseTicketFlow(intent),
      usedWebSearch: Boolean(reply.usedWebSearch)
    });

    return reply;
  } catch (error) {
    await updateBotRunLog({
      errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
      latencyMs: Date.now() - startedAt,
      metadata: {
        channel,
        needsWebSearch: route.needsWebSearch,
        routerConfidence: route.routerConfidence,
        routerReason: route.routerReason,
        routerType: route.routerType,
        selectedTarget: route.selectedTarget,
        executionLog: route.intent ? [{ action: "Error", details: error instanceof Error ? error.message : "Unknown error" }] : undefined
      },
      runId: run?.id,
      status: "error",
      usedOpenAI: mightUseOpenAI(route, false),
      usedStudyMemory: didUseStudyMemory(intent),
      usedTicketFlow: didUseTicketFlow(intent),
      usedWebSearch: false
    });

    throw error;
  }
}
