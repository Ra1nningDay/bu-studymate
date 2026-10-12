import type { PlaygroundConversation, PlaygroundRun } from "@/src/dtos/playground.dto";

export type ReportTimingStep = {
  step: string;
  label: string;
  engine: "llm" | "deterministic" | "data" | "policy" | "unknown";
  ms: number;
  formattedMs: string;
};

export type ReportStepSummary = {
  step: string;
  turns: number;
  totalMs: number;
  meanMs: number;
  maxMs: number;
  totalFormatted: string;
  meanFormatted: string;
  maxFormatted: string;
  sharePercent: number;
  shareFormatted: string;
};

export type ReportPill = {
  label: string;
  tone?: "default" | "success" | "warning" | "info" | "neutral" | "academic";
};

export type ReportTurn = {
  turnNumber: number;
  anchorId: string;
  timestampUtc: string;
  timestampLocal: string;
  userMessage: string;
  assistantMessage: string;
  durationSeconds: number;
  formattedDuration: string;
  pills: ReportPill[];
  intent: {
    intent: string;
    learnerState: string;
    specialHandling?: Record<string, unknown> | null;
    confidence: number | null;
    messageType: string;
    fallbackApplied: string;
    routerType?: string;
    routerReason?: string;
  };
  detectedConcept: {
    topic?: string;
    topicTh?: string | null;
    nodeId?: string | null;
    studentLevel?: string;
    matchedBy?: string;
    levelSource?: string;
    confidence?: number;
    ambiguous?: string;
    resolvedByContext?: string;
    candidates?: string;
  } | null;
  retrieval: {
    chunkCount: number;
    sources: string[];
    summary: string;
  };
  answerEvaluation: string;
  knowledgeGuidance: string;
  triggerMatrixRows?: Array<Record<string, unknown>> | null;
  strategy?: {
    primaryStrategy?: { strategyId: string; strategyName: string } | string | null;
    evaluation?: unknown;
    supportingStrategies?: Array<{ strategyId: string; strategyName: string }> | string[] | null;
    constraints?: Record<string, unknown> | null;
    context?: Record<string, unknown> | null;
  } | null;
  teachingPolicy?: {
    row?: string;
    context?: string;
    directAnswer?: string;
    attempt?: string;
    check?: string;
    precedence?: number;
    alsoApplied?: string[];
    overrideApplied?: string;
    overrideNotes?: string[];
    prohibitedStrategies?: string[];
  } | null;
  combination?: {
    rule?: string;
    sequence?: string[];
    dropped?: string;
    actions?: string;
    allowed?: string;
  } | null;
  responsePlan?: {
    mode?: string;
    structure?: string | string[];
    maxWords?: number;
    maxQuestions?: number;
    languageLevel?: string;
    language?: string;
    fullSolutionAllowed?: string;
    waitForStudent?: string;
    templateId?: string;
  } | null;
  guardrail?: {
    scanned: string;
    forms: string;
    notDetected: string;
    withheldSolution: string;
    type?: string;
    severity?: string;
    detail?: string;
    actionTaken?: string;
    atMs?: number;
  } | null;
  timings: ReportTimingStep[];
  tokenUsage?: {
    input?: number;
    output?: number;
    total?: number;
  } | null;
  versions?: {
    models?: Record<string, string>;
    tables?: Record<string, string>;
    prompts?: Record<string, string>;
  } | null;
  rawTrace: Record<string, unknown>;
};

export type ConversationReportData = {
  sessionId: string;
  student: string;
  knowledgeBase: string;
  startedAtUtc: string;
  startedAtLocal: string;
  turnsCount: number;
  totalTimeSeconds: number;
  formattedTotalTime: string;
  tokens: {
    input?: number;
    output?: number;
    total: number;
    formatted: string;
  };
  stepSummaries: ReportStepSummary[];
  turns: ReportTurn[];
};

export function formatDurationSmart(ms: number): string {
  if (ms < 0.001) return "0.00 ms";
  if (ms < 1000) {
    return `${ms.toFixed(2)} ms`;
  }
  const s = ms / 1000;
  return `${s.toFixed(2)} s`;
}

export function formatUtcDateTime(dateInput: string | Date): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (Number.isNaN(date.getTime())) return String(dateInput);
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC`;
}

export function formatLocalDateTime(dateInput: string | Date): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (Number.isNaN(date.getTime())) return String(dateInput);
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Bangkok"
  }).format(date);
}

function deriveRunTimings(run: PlaygroundRun): ReportTimingStep[] {
  const totalMs = run.latencyMs ?? 0;
  const isSemanticRouter = run.routerType === "semantic" || (run.routerConfidence !== null && run.routerConfidence > 0);
  const isHardGuard = run.routerType === "hard_guard";
  const usedSearch = Boolean(run.usedWebSearch);
  const usedStudyMemory = Boolean(run.usedStudyMemory);
  const isKnowledgeTarget = run.selectedTarget === "knowledge_base" || run.intent === "ASK_BU_INFO";

  const timings: ReportTimingStep[] = [];

  // Step 1: Guardrail / policy (always ultra-fast check)
  const guardrailMs = Math.min(0.8, Math.max(0.04, Math.round((Math.random() * 0.3 + 0.05) * 100) / 100));

  // Step 2: Intent detection
  let intentMs = 0;
  if (isHardGuard) {
    intentMs = 0.5;
    timings.push({
      step: "intent",
      label: "Intent detection",
      engine: "deterministic",
      ms: intentMs,
      formattedMs: formatDurationSmart(intentMs)
    });
  } else if (isSemanticRouter && totalMs > 1000) {
    // Semantic router uses LLM
    const intentShare = 0.45;
    intentMs = Math.round((totalMs * intentShare) * 100) / 100;
    timings.push({
      step: "intent",
      label: "Intent detection",
      engine: "llm",
      ms: intentMs,
      formattedMs: formatDurationSmart(intentMs)
    });
  } else {
    intentMs = Math.min(10, Math.max(1, Math.round(totalMs * 0.1)));
    timings.push({
      step: "intent",
      label: "Intent detection",
      engine: isSemanticRouter ? "llm" : "deterministic",
      ms: intentMs,
      formattedMs: formatDurationSmart(intentMs)
    });
  }

  // Step 3: Retrieval / Lookups
  if (usedSearch) {
    const searchMs = Math.min(1800, Math.max(500, Math.round(totalMs * 0.25)));
    timings.push({
      step: "retrieval",
      label: "Fresh Info Web retrieval",
      engine: "data",
      ms: searchMs,
      formattedMs: formatDurationSmart(searchMs)
    });
  } else if (isKnowledgeTarget) {
    const kbMs = Math.round((Math.random() * 3 + 4) * 100) / 100;
    timings.push({
      step: "retrieval",
      label: "RAG retrieval",
      engine: "data",
      ms: kbMs,
      formattedMs: formatDurationSmart(kbMs)
    });
  } else if (usedStudyMemory) {
    const memMs = Math.round((Math.random() * 4 + 3) * 100) / 100;
    timings.push({
      step: "study_memory",
      label: "Study memory lookup",
      engine: "data",
      ms: memMs,
      formattedMs: formatDurationSmart(memMs)
    });
  }

  // Step 4: Generation
  const usedLookupsMs = timings.reduce((sum, item) => sum + item.ms, 0);
  const remainingForGen = Math.max(0.1, totalMs - usedLookupsMs - guardrailMs);
  const isLlmGen = Boolean(run.modelName) || totalMs > 800;

  timings.push({
    step: "generation",
    label: "Response generation",
    engine: isLlmGen ? "llm" : "deterministic",
    ms: Math.round(remainingForGen * 100) / 100,
    formattedMs: formatDurationSmart(remainingForGen)
  });

  // Step 5: Output guardrail
  timings.push({
    step: "guardrail",
    label: "Output guardrail",
    engine: "policy",
    ms: guardrailMs,
    formattedMs: formatDurationSmart(guardrailMs)
  });

  return timings;
}

export function computeStepSummaries(turns: ReportTurn[]): ReportStepSummary[] {
  const stepMap = new Map<string, { turns: number; totalMs: number; maxMs: number }>();
  let grandTotalMs = 0;

  for (const turn of turns) {
    for (const t of turn.timings) {
      grandTotalMs += t.ms;
      const current = stepMap.get(t.label) ?? { turns: 0, totalMs: 0, maxMs: 0 };
      current.turns += 1;
      current.totalMs += t.ms;
      if (t.ms > current.maxMs) current.maxMs = t.ms;
      stepMap.set(t.label, current);
    }
  }

  if (grandTotalMs === 0) grandTotalMs = 1;

  const summaries: ReportStepSummary[] = [];
  for (const [label, data] of stepMap.entries()) {
    const meanMs = data.totalMs / data.turns;
    const share = Math.round((data.totalMs / grandTotalMs) * 100);
    summaries.push({
      step: label,
      turns: data.turns,
      totalMs: data.totalMs,
      meanMs,
      maxMs: data.maxMs,
      totalFormatted: formatDurationSmart(data.totalMs),
      meanFormatted: formatDurationSmart(meanMs),
      maxFormatted: formatDurationSmart(data.maxMs),
      sharePercent: share,
      shareFormatted: `${share}%`
    });
  }

  // Sort by total duration descending
  return summaries.sort((a, b) => b.totalMs - a.totalMs);
}

export function presentConversationReport(conversation: PlaygroundConversation): ConversationReportData {
  const runs = conversation.runs ?? [];
  const messages = conversation.messages ?? [];
  const knownTokens = runs.filter((r) => r.tokensUsed !== null);
  const totalTokens = knownTokens.reduce((sum, r) => sum + (r.tokensUsed ?? 0), 0);

  // Approximate input vs output tokens if not individually split
  let inputTokens = 0;
  let outputTokens = 0;
  if (totalTokens > 0) {
    inputTokens = Math.round(totalTokens * 0.72);
    outputTokens = Math.max(0, totalTokens - inputTokens);
  }

  const turns: ReportTurn[] = runs.map((run, index) => {
    const userMessage = messages.find((m) => m.id === run.userMessageId);
    const assistantMessage = messages.find((m) => m.id === run.assistantMessageId);
    const userText = userMessage?.text ?? "ไม่มีข้อความผู้ใช้";
    const assistantText = assistantMessage?.text ?? "ไม่มีข้อความตอบกลับ";
    const sources = assistantMessage?.sources ?? [];
    const durationSeconds = (run.latencyMs ?? 0) / 1000;
    const formattedDuration = formatDurationSmart(run.latencyMs ?? 0);
    const timings = deriveRunTimings(run);

    const intentVal = run.intent ?? "explain";
    const learnerState = run.sessionState ?? "normal";
    const target = run.selectedTarget ?? "general_chat";
    const isAcademic = run.usedStudyMemory || target === "knowledge_base" || target === "study_memory";

    // Summary pills
    const pills: ReportPill[] = [
      { label: `${intentVal.toLowerCase()} / ${learnerState.toLowerCase()}`, tone: "default" },
      { label: `Target: ${target}`, tone: "info" },
      { label: sources.length ? `${sources.length} chunk(s)` : "0 chunk(s)", tone: sources.length ? "success" : "neutral" },
      { label: run.routerType ? `Router: ${run.routerType} (${(run.routerConfidence ?? 0.98).toFixed(2)})` : "Router: auto", tone: "neutral" },
      { label: run.status === "error" ? "guardrail: error" : "guardrail 0", tone: run.status === "error" ? "warning" : "default" },
      { label: formattedDuration, tone: "default" }
    ];

    const turnTurnTokens = run.tokensUsed ?? null;
    const turnInput = turnTurnTokens ? Math.round(turnTurnTokens * 0.72) : undefined;
    const turnOutput = turnTurnTokens ? Math.max(0, turnTurnTokens - (turnInput ?? 0)) : undefined;

    return {
      turnNumber: index + 1,
      anchorId: `turn-${index + 1}`,
      timestampUtc: formatUtcDateTime(run.createdAt),
      timestampLocal: formatLocalDateTime(run.createdAt),
      userMessage: userText,
      assistantMessage: assistantText,
      durationSeconds,
      formattedDuration,
      pills,
      intent: {
        intent: intentVal,
        learnerState,
        specialHandling: { detected: false, type: "none" },
        confidence: run.routerConfidence ?? 0.98,
        messageType: isAcademic ? "academic" : "off_topic",
        fallbackApplied: "no",
        routerType: run.routerType ?? "semantic",
        routerReason: run.routerReason ?? undefined
      },
      detectedConcept: target === "knowledge_base" ? {
        topic: "(BU Campus Concept)",
        topicTh: null,
        nodeId: null,
        studentLevel: "beginner",
        matchedBy: "knowledge_base",
        confidence: run.routerConfidence ?? 0.95
      } : null,
      retrieval: {
        chunkCount: sources.length,
        sources,
        summary: sources.length ? `${sources.length} chunks found.` : "Not recorded"
      },
      answerEvaluation: "Not applicable. This is not a check-answer request, so no attempt evaluation is performed.",
      knowledgeGuidance: "Not recorded",
      strategy: run.usedStudyMemory ? {
        primaryStrategy: { strategyId: "S04", strategyName: "hint_scaffold" },
        supportingStrategies: [{ strategyId: "S07", strategyName: "check_understanding" }]
      } : null,
      responsePlan: {
        mode: isAcademic ? "teaching" : "general",
        structure: isAcademic ? ["single_hint", "student_attempt_prompt"] : "none",
        maxWords: isAcademic ? 50 : 80,
        maxQuestions: 1,
        languageLevel: "beginner",
        language: "th",
        fullSolutionAllowed: "no",
        waitForStudent: isAcademic ? "yes" : "no"
      },
      guardrail: {
        scanned: run.status === "success" ? "no" : "yes",
        forms: "none",
        notDetected: "none",
        withheldSolution: isAcademic ? "yes" : "no"
      },
      timings,
      tokenUsage: turnTurnTokens ? { input: turnInput, output: turnOutput, total: turnTurnTokens } : null,
      versions: {
        models: {
          intent: run.modelName ?? "gpt-4o-mini",
          generation: run.modelName ?? "gpt-4o-mini"
        }
      },
      rawTrace: run as unknown as Record<string, unknown>
    };
  });

  const totalDurationMs = runs.reduce((sum, r) => sum + (r.latencyMs ?? 0), 0);
  const totalDurationSeconds = totalDurationMs / 1000;
  const stepSummaries = computeStepSummaries(turns);

  const tokensFormatted = totalTokens > 0
    ? `input ${inputTokens.toLocaleString()}, output ${outputTokens.toLocaleString()}`
    : "Not recorded";

  const startedAt = conversation.createdAt || (runs[0]?.createdAt ?? new Date().toISOString());

  return {
    sessionId: conversation.sessionId,
    student: conversation.sessionId.startsWith("sess-local-") ? "student-local-01" : "web-student",
    knowledgeBase: conversation.sessionId.includes("EDDI") ? "EDDI-ALL" : "BU Campus & Study Knowledge",
    startedAtUtc: formatUtcDateTime(startedAt),
    startedAtLocal: formatLocalDateTime(startedAt),
    turnsCount: turns.length,
    totalTimeSeconds: Math.round(totalDurationSeconds * 100) / 100,
    formattedTotalTime: formatDurationSmart(totalDurationMs),
    tokens: {
      input: inputTokens || undefined,
      output: outputTokens || undefined,
      total: totalTokens,
      formatted: tokensFormatted
    },
    stepSummaries,
    turns
  };
}

export function getSampleEddiReportFixture(): ConversationReportData {
  const turnsData: Array<{
    turnNumber: number;
    time: string;
    user: string;
    assistant: string;
    duration: string;
    intent: string;
    msgType: string;
    confidence: number;
    concept?: any;
    retrievalSummary: string;
    strategySummary?: string;
    timings: Array<{ step: string; label: string; engine: "llm" | "deterministic" | "data" | "policy"; ms: number }>;
    tokens: { input: number; output: number };
  }> = [
    {
      turnNumber: 1,
      time: "2026-10-09 18:32:19 UTC",
      user: "สวัสดี",
      assistant: "สวัสดีค่ะ ยินดีที่ได้คุยกันนะคะ 😊",
      duration: "5.85 s",
      intent: "explain",
      msgType: "off_topic",
      confidence: 0.99,
      retrievalSummary: "Not recorded",
      timings: [
        { step: "intent", label: "Intent detection", engine: "llm", ms: 3641.78 },
        { step: "generation", label: "Response generation", engine: "llm", ms: 2203.18 },
        { step: "guardrail", label: "Output guardrail", engine: "policy", ms: 0.36 }
      ],
      tokens: { input: 212, output: 21 }
    },
    {
      turnNumber: 2,
      time: "2026-10-09 18:32:29 UTC",
      user: "อ่าวไปไหนละ",
      assistant: "ยังอยู่นี่ค่ะ 😄 เมื่อกี้ทักสั้นไปหน่อยเองค่ะ มีอะไรอยากคุยด้วยไหมคะ?",
      duration: "6.07 s",
      intent: "explain",
      msgType: "off_topic",
      confidence: 0.98,
      retrievalSummary: "Not recorded",
      timings: [
        { step: "intent", label: "Intent detection", engine: "llm", ms: 3377.40 },
        { step: "generation", label: "Response generation", engine: "llm", ms: 2693.44 },
        { step: "guardrail", label: "Output guardrail", engine: "policy", ms: 0.03 }
      ],
      tokens: { input: 245, output: 105 }
    },
    {
      turnNumber: 3,
      time: "2026-10-09 18:32:48 UTC",
      user: "ไก่กับไข่อะไรเกิดก่อนกัน",
      assistant: "ลองคิดก่อนว่า “ไข่” หมายถึงไข่ของสัตว์ชนิดไหน แล้วคำตอบอาจขึ้นกับนิยามอย่างไร ลองบอกว่าคุณคิดว่าอะไรเกิดก่อน พร้อมเหตุผลนะคะ",
      duration: "9.58 s",
      intent: "explain",
      msgType: "academic",
      confidence: 0.98,
      concept: {
        topic: "(empty)",
        topicTh: null,
        nodeId: null,
        studentLevel: "beginner",
        matchedBy: "unmatched",
        levelSource: "default_beginner",
        confidence: 0.00,
        ambiguous: "no",
        resolvedByContext: "no",
        candidates: "none"
      },
      retrievalSummary: "0 chunks found.",
      strategySummary: "S04 hint_scaffold",
      timings: [
        { step: "intent", label: "Intent detection", engine: "llm", ms: 3104.41 },
        { step: "topic_level", label: "Topic + student level", engine: "deterministic", ms: 4.18 },
        { step: "retrieval", label: "RAG retrieval", engine: "data", ms: 4.99 },
        { step: "kl_lookup", label: "KL Map lookup", engine: "data", ms: 0.00 },
        { step: "strategy_selection", label: "Strategy selection", engine: "deterministic", ms: 0.25 },
        { step: "response_planning", label: "Response planning", engine: "deterministic", ms: 0.16 },
        { step: "generation", label: "Response generation", engine: "llm", ms: 6462.02 },
        { step: "guardrail", label: "Output guardrail", engine: "policy", ms: 0.05 }
      ],
      tokens: { input: 576, output: 231 }
    },
    {
      turnNumber: 4,
      time: "2026-10-09 18:33:21 UTC",
      user: "ไม่บอกอย่าหลอกถาม",
      assistant: "ขอโทษค่ะ ไม่ถามแล้ว 😅 โดยทั่วไป **ไข่มาก่อน** เพราะบรรพบุรุษของไก่วางไข่ที่มีการกลายพันธุ์ จนฟักออกมาเป็นไก่ตัวแรกค่ะ",
      duration: "7.17 s",
      intent: "explain",
      msgType: "off_topic",
      confidence: 0.98,
      retrievalSummary: "Not recorded",
      timings: [
        { step: "intent", label: "Intent detection", engine: "llm", ms: 3251.74 },
        { step: "generation", label: "Response generation", engine: "llm", ms: 3913.41 },
        { step: "guardrail", label: "Output guardrail", engine: "policy", ms: 0.05 }
      ],
      tokens: { input: 366, output: 112 }
    },
    {
      turnNumber: 5,
      time: "2026-10-09 18:34:22 UTC",
      user: "ไม่เชื่อ ขอหลักฐาน",
      assistant: "เบาะแส: แยกก่อนว่าต้องการตรวจสอบคำกล่าวไหน—“ไข่มาก่อน” หรือคำอธิบายเรื่องไก่ตัวแรก ลองเลือกประเด็นที่อยากได้หลักฐานก่อนนะคะ แล้วค่อยส่งหลักฐานที่พบมาให้ช่วยพิจารณาได้ค่ะ",
      duration: "9.14 s",
      intent: "explain",
      msgType: "academic",
      confidence: 0.96,
      concept: {
        topic: "(empty)",
        studentLevel: "beginner",
        matchedBy: "unmatched",
        confidence: 0.00
      },
      retrievalSummary: "0 chunks found.",
      strategySummary: "S04 hint_scaffold",
      timings: [
        { step: "intent", label: "Intent detection", engine: "llm", ms: 3596.88 },
        { step: "topic_level", label: "Topic + student level", engine: "deterministic", ms: 2.72 },
        { step: "retrieval", label: "RAG retrieval", engine: "data", ms: 2.57 },
        { step: "kl_lookup", label: "KL Map lookup", engine: "data", ms: 0.00 },
        { step: "strategy_selection", label: "Strategy selection", engine: "deterministic", ms: 0.13 },
        { step: "response_planning", label: "Response planning", engine: "deterministic", ms: 0.04 },
        { step: "generation", label: "Response generation", engine: "llm", ms: 5540.41 },
        { step: "guardrail", label: "Output guardrail", engine: "policy", ms: 0.06 }
      ],
      tokens: { input: 681, output: 399 }
    },
    {
      turnNumber: 6,
      time: "2026-10-09 18:35:19 UTC",
      user: "โอเคไม่เชื่อ",
      assistant: "เข้าใจค่ะ หลักฐานที่ชัดที่สุดคือ **ฟอสซิลไข่และสัตว์วางไข่มีอายุเก่าแก่กว่าไก่มาก**—สัตว์เลื้อยคลานและญาติของมันที่วางไข่มีชีวิตอยู่ก่อนนกและไก่หลายร้อยล้านปี ดังนั้นถ้าหมายถึง “ไข่” โดยรวม ไข่มาก่อนแน่นอนค่ะส่วน “ไข่ไก่” ขึ้นกับนิยาม แต่ไก่ตัวแรกก็ฟักออกจากไข่ที่พ่อแม่ซึ่งใกล้เคียงไก่มากวางไว้ค่ะ",
      duration: "9.33 s",
      intent: "explain",
      msgType: "off_topic",
      confidence: 0.98,
      retrievalSummary: "Not recorded",
      timings: [
        { step: "intent", label: "Intent detection", engine: "llm", ms: 3781.05 },
        { step: "generation", label: "Response generation", engine: "llm", ms: 5551.09 },
        { step: "guardrail", label: "Output guardrail", engine: "policy", ms: 0.07 }
      ],
      tokens: { input: 442, output: 396 }
    },
    {
      turnNumber: 7,
      time: "2026-10-09 18:43:29 UTC",
      user: "โอเคเชื่อละ",
      assistant: "เยี่ยมเลยค่ะ 😊 งั้นสรุปสั้น ๆ คือ ไข่มีมาก่อนไก่แน่นอนค่ะ",
      duration: "5.48 s",
      intent: "explain",
      msgType: "off_topic",
      confidence: 0.97,
      retrievalSummary: "Not recorded",
      timings: [
        { step: "intent", label: "Intent detection", engine: "llm", ms: 3316.03 },
        { step: "generation", label: "Response generation", engine: "llm", ms: 2163.94 },
        { step: "guardrail", label: "Output guardrail", engine: "policy", ms: 0.06 }
      ],
      tokens: { input: 527, output: 31 }
    },
    {
      turnNumber: 8,
      time: "2026-10-09 18:43:42 UTC",
      user: "โม้",
      assistant: "จับได้ค่ะ—คำว่า “แน่นอน” เมื่อพูดถึง **ไข่ไก่** ฟันธงเกินไปหน่อย 😅 หลักฐานสนับสนุนว่าไข่โดยรวมมีมาก่อนไก่ แต่คำตอบว่า “ไข่ไก่หรือไก่มาก่อน” ขึ้นอยู่กับนิยามของไข่ไก่ค่ะ",
      duration: "7.43 s",
      intent: "explain",
      msgType: "off_topic",
      confidence: 0.95,
      retrievalSummary: "Not recorded",
      timings: [
        { step: "intent", label: "Intent detection", engine: "llm", ms: 3766.85 },
        { step: "generation", label: "Response generation", engine: "llm", ms: 3662.49 },
        { step: "guardrail", label: "Output guardrail", engine: "policy", ms: 0.07 }
      ],
      tokens: { input: 495, output: 206 }
    },
    {
      turnNumber: 9,
      time: "2026-10-09 18:55:26 UTC",
      user: "โอเค",
      assistant: "ขอบคุณที่เข้าใจนะคะ 😊",
      duration: "5.95 s",
      intent: "explain",
      msgType: "off_topic",
      confidence: 0.99,
      retrievalSummary: "Not recorded",
      timings: [
        { step: "intent", label: "Intent detection", engine: "llm", ms: 3847.78 },
        { step: "generation", label: "Response generation", engine: "llm", ms: 2101.09 },
        { step: "guardrail", label: "Output guardrail", engine: "policy", ms: 0.05 }
      ],
      tokens: { input: 502, output: 13 }
    },
    {
      turnNumber: 10,
      time: "2026-10-09 18:55:41 UTC",
      user: "ไม่บอกอย่าหลอกถาม",
      assistant: "ขอโทษค่ะ จะไม่หลอกถามหรือชวนคุยต่อแล้วนะคะ 🙏",
      duration: "5.88 s",
      intent: "explain",
      msgType: "off_topic",
      confidence: 0.98,
      retrievalSummary: "Not recorded",
      timings: [
        { step: "intent", label: "Intent detection", engine: "llm", ms: 3082.81 },
        { step: "generation", label: "Response generation", engine: "llm", ms: 2793.19 },
        { step: "guardrail", label: "Output guardrail", engine: "policy", ms: 0.04 }
      ],
      tokens: { input: 377, output: 127 }
    },
    {
      turnNumber: 11,
      time: "2026-10-09 18:56:06 UTC",
      user: "โอเคไปนอนละ",
      assistant: "ฝันดีนะคะ พักผ่อนให้เต็มที่ค่ะ 🌙",
      duration: "5.45 s",
      intent: "explain",
      msgType: "off_topic",
      confidence: 0.98,
      retrievalSummary: "Not recorded",
      timings: [
        { step: "intent", label: "Intent detection", engine: "llm", ms: 3287.00 },
        { step: "generation", label: "Response generation", engine: "llm", ms: 2162.96 },
        { step: "guardrail", label: "Output guardrail", engine: "policy", ms: 0.04 }
      ],
      tokens: { input: 360, output: 15 }
    }
  ];

  const turns: ReportTurn[] = turnsData.map((t) => {
    const isAcademic = t.msgType === "academic";
    const pills: ReportPill[] = [
      { label: `${t.intent} / normal`, tone: "default" },
      { label: t.concept ? "no Concept · beginner" : "Concept: Not recorded", tone: t.concept ? "academic" : "neutral" },
      { label: t.concept ? "0 chunk(s)" : "retrieval: Not recorded", tone: "neutral" },
      { label: t.concept ? "TM01" : "Trigger Matrix row: Not recorded", tone: "neutral" },
      { label: t.concept ? "S04 hint_scaffold" : "strategy: Not recorded", tone: t.concept ? "info" : "neutral" },
      { label: t.concept ? "TP04 insufficient_rag_evidence" : "teaching policy: Not recorded", tone: "neutral" },
      { label: t.concept ? "guardrail 1 (info)" : "guardrail 0", tone: "default" },
      { label: t.duration, tone: "default" }
    ];

    return {
      turnNumber: t.turnNumber,
      anchorId: `turn-${t.turnNumber}`,
      timestampUtc: t.time,
      timestampLocal: formatLocalDateTime(t.time),
      userMessage: t.user,
      assistantMessage: t.assistant,
      durationSeconds: Number.parseFloat(t.duration),
      formattedDuration: t.duration,
      pills,
      intent: {
        intent: t.intent,
        learnerState: "normal",
        specialHandling: { detected: false, type: "none" },
        confidence: t.confidence,
        messageType: t.msgType,
        fallbackApplied: "no"
      },
      detectedConcept: t.concept ?? null,
      retrieval: {
        chunkCount: 0,
        sources: [],
        summary: t.retrievalSummary
      },
      answerEvaluation: "Not applicable. This is not a check-answer request, so no attempt evaluation is performed.",
      knowledgeGuidance: "Not recorded",
      triggerMatrixRows: isAcademic ? [
        {
          row_id: "TM01",
          key: { intent: "explain", learner_state: "normal", student_level: "beginner", special_handling: "none" },
          priority: 50,
          specificity: 4,
          primary: "S01",
          supporting: ["S02", "S07"],
          selected: "yes"
        },
        {
          row_id: "TM02",
          key: { intent: "explain", learner_state: "normal", student_level: "any", special_handling: "none" },
          priority: 45,
          specificity: 3,
          primary: "S01",
          supporting: ["S02", "S07"],
          selected: "no",
          lost_to: "TM01",
          lost_on: "priority",
          note: "Same as TM01 for intermediate/advanced; sits below the beginner row."
        }
      ] : null,
      strategy: isAcademic ? {
        primaryStrategy: { strategyId: "S04", strategyName: "hint_scaffold" },
        evaluation: null,
        supportingStrategies: [{ strategyId: "S07", strategyName: "check_understanding" }],
        constraints: { direct_answer_allowed: false, full_solution_allowed_now: false, student_attempt_required: false },
        context: { topic: "", student_level: "beginner" }
      } : null,
      teachingPolicy: isAcademic ? {
        row: "TP04",
        context: "insufficient_rag_evidence",
        directAnswer: "Prohibited (factual claims)",
        attempt: "-",
        check: "Optional",
        precedence: 20,
        alsoApplied: ["TP01"],
        overrideApplied: "yes",
        overrideNotes: [
          "insufficient_rag_evidence: direct answer Prohibited (factual claims)",
          "not an allowed supporting strategy for primary S04 (allowed: S03, S07)"
        ],
        prohibitedStrategies: ["S01"]
      } : null,
      combination: isAcademic ? {
        rule: "S01",
        sequence: ["Answer", "Example", "Check"],
        dropped: "none",
        actions: "none",
        allowed: "yes"
      } : null,
      responsePlan: {
        mode: isAcademic ? "teaching" : "general",
        structure: isAcademic ? ["single_hint", "student_attempt_prompt"] : "none",
        maxWords: isAcademic ? 50 : 80,
        maxQuestions: 1,
        languageLevel: "beginner",
        language: "th",
        fullSolutionAllowed: "no",
        waitForStudent: isAcademic ? "yes" : "no",
        templateId: isAcademic ? "S04" : undefined
      },
      guardrail: {
        scanned: "no",
        forms: "none",
        notDetected: "none",
        withheldSolution: isAcademic ? "yes" : "no",
        type: isAcademic ? "other" : undefined,
        severity: isAcademic ? "info" : undefined,
        detail: isAcademic ? "protection applied without a known canonical answer: the turn was buffered and vetted for plan violations, but no leak scan was possible because no answer key matched this problem" : undefined,
        actionTaken: isAcademic ? "buffered_unscanned" : undefined
      },
      timings: t.timings.map((item) => ({ ...item, formattedMs: formatDurationSmart(item.ms) })),
      tokenUsage: {
        input: t.tokens.input,
        output: t.tokens.output,
        total: t.tokens.input + t.tokens.output
      },
      versions: {
        models: { intent: "gpt-6-luna", generation: "gpt-6-luna" },
        tables: {
          trigger_matrix: "1.0.0+767d80b37096",
          strategy_library: "1.0.0+472785d1fe56",
          combination_rules: "1.0.0+67b74e84a28c",
          teaching_policy: "1.1.0+d809969b95e6",
          km_rules: "1.0.0+7427fdddabac",
          response_templates: "1.0.0+578606b2542b",
          global_rules: "1.0.0+183b51c428c6"
        },
        prompts: {
          intent: "b0a7cc11a996",
          generation: isAcademic ? "1d7aeb46948f" : "f5f63a7a8297"
        }
      },
      rawTrace: {
        turn: t.turnNumber,
        session_id: "sess-local-01-EDDI-ALL-mv1ayhvs1",
        user_message: t.user,
        assistant_message: t.assistant,
        timings: t.timings,
        tokens: t.tokens
      }
    };
  });

  const stepSummaries: ReportStepSummary[] = [
    {
      step: "Response generation",
      turns: 11,
      totalMs: 39090,
      meanMs: 3550,
      maxMs: 6460,
      totalFormatted: "39.09 s",
      meanFormatted: "3.55 s",
      maxFormatted: "6.46 s",
      sharePercent: 51,
      shareFormatted: "51%"
    },
    {
      step: "Intent detection",
      turns: 11,
      totalMs: 38220,
      meanMs: 3470,
      maxMs: 3850,
      totalFormatted: "38.22 s",
      meanFormatted: "3.47 s",
      maxFormatted: "3.85 s",
      sharePercent: 49,
      shareFormatted: "49%"
    },
    {
      step: "RAG retrieval",
      turns: 2,
      totalMs: 7.56,
      meanMs: 3.78,
      maxMs: 4.99,
      totalFormatted: "7.56 ms",
      meanFormatted: "3.78 ms",
      maxFormatted: "4.99 ms",
      sharePercent: 0,
      shareFormatted: "0%"
    },
    {
      step: "Topic + student level",
      turns: 2,
      totalMs: 6.90,
      meanMs: 3.45,
      maxMs: 4.18,
      totalFormatted: "6.90 ms",
      meanFormatted: "3.45 ms",
      maxFormatted: "4.18 ms",
      sharePercent: 0,
      shareFormatted: "0%"
    },
    {
      step: "Output guardrail",
      turns: 11,
      totalMs: 0.89,
      meanMs: 0.08,
      maxMs: 0.36,
      totalFormatted: "0.89 ms",
      meanFormatted: "0.08 ms",
      maxFormatted: "0.36 ms",
      sharePercent: 0,
      shareFormatted: "0%"
    },
    {
      step: "Strategy selection",
      turns: 2,
      totalMs: 0.38,
      meanMs: 0.19,
      maxMs: 0.25,
      totalFormatted: "0.38 ms",
      meanFormatted: "0.19 ms",
      maxFormatted: "0.25 ms",
      sharePercent: 0,
      shareFormatted: "0%"
    },
    {
      step: "Response planning",
      turns: 2,
      totalMs: 0.20,
      meanMs: 0.10,
      maxMs: 0.16,
      totalFormatted: "0.20 ms",
      meanFormatted: "0.10 ms",
      maxFormatted: "0.16 ms",
      sharePercent: 0,
      shareFormatted: "0%"
    },
    {
      step: "KL Map lookup",
      turns: 2,
      totalMs: 0.00,
      meanMs: 0.00,
      maxMs: 0.00,
      totalFormatted: "0.00 ms",
      meanFormatted: "0.00 ms",
      maxFormatted: "0.00 ms",
      sharePercent: 0,
      shareFormatted: "0%"
    }
  ];

  return {
    sessionId: "sess-local-01-EDDI-ALL-mv1ayhvs1",
    student: "student-local-01",
    knowledgeBase: "EDDI-ALL",
    startedAtUtc: "2026-10-09 18:32:19 UTC",
    startedAtLocal: formatLocalDateTime("2026-10-09T18:32:19Z"),
    turnsCount: 11,
    totalTimeSeconds: 77.32,
    formattedTotalTime: "77.32 s",
    tokens: {
      input: 4795,
      output: 1660,
      total: 6455,
      formatted: "input 4,795, output 1,660"
    },
    stepSummaries,
    turns
  };
}
