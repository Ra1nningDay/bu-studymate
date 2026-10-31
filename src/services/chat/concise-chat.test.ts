import assert from "node:assert/strict";
import { afterEach, before, test } from "node:test";
import { createConciseChatFixture, type ConversationMessage } from "@/evals/concise-chat/fixtures";

let env: typeof import("@/src/config/env").env;
const originalFetch = globalThis.fetch;

before(async () => {
  process.env.DATABASE_URL ??= "postgresql://fixture:fixture@localhost:5432/fixture_unused";
  ({ env } = await import("@/src/config/env"));
  env.OPENAI_API_KEY = "synthetic-key";
  env.AGENT_ROUTER_MODE = "openai";
});

afterEach(() => { globalThis.fetch = originalFetch; env.AGENT_ROUTER_MODE = "openai"; });

type RequestBody = {
  input?: Array<{ role: string; content: string }>;
  messages?: ConversationMessage[];
  max_completion_tokens?: number;
  tools?: unknown[];
};

function controlledOpenAi(intent: string, answer: string, safetyCritical = false) {
  const requests: Array<{ url: string; body: RequestBody }> = [];
  const targets: Record<string, string> = {
    GENERAL_CHAT: "general_chat", UNKNOWN: "unknown", OUT_OF_SCOPE: "out_of_scope",
    ASK_BU_INFO: "knowledge_base", ASK_STUDY_MEMORY: "study_memory", CREATE_TICKET: "ticket"
  };
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body)) as RequestBody;
    requests.push({ url, body });
    if (body.tools?.length) return Response.json({ output_text: "VERIFIED_SOURCE_NOT_FOUND" });
    if (url.endsWith("/responses")) {
      return Response.json({
        model: "synthetic-router", usage: { total_tokens: 10 },
        output_text: JSON.stringify({ intent, selectedTarget: targets[intent], confidence: 0.99,
          needsWebSearch: false, reason: "Controlled model decision", safetyCritical })
      });
    }
    assert.equal(url, "https://api.openai.com/v1/chat/completions");
    return Response.json({ model: "synthetic-answer", choices: [{ message: { content: answer }, finish_reason: "stop" }], usage: { total_tokens: 12 } });
  };
  return requests;
}

function jsonMetadata(value: unknown): Record<string, unknown> {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  return value as Record<string, unknown>;
}

for (const channel of ["line", "web"] as const) {
  for (const [message, expected] of [
    ["อธิบายสงครามโลกครั้งที่หนึ่ง", "เรื่องนี้อยู่นอกขอบเขตของ StudyMate ครับ ผมช่วยเรื่องข้อมูล BU บทเรียน และการแจ้งปัญหาภายในมหาวิทยาลัยได้"],
    ["Explain World War One.", "That is outside StudyMate's scope. I can help with BU information, study materials, and campus issue reports."]
  ]) {
    test(`${channel}: out-of-scope returns exact localized text without answer generation (${message})`, async () => {
      const requests = controlledOpenAi("OUT_OF_SCOPE", "This answer must never be used.");
      const fixture = await createConciseChatFixture();
      const reply = await fixture.service.createBotReply({ channel, lineUserId: "synthetic-eval-user", message });
      assert.equal(reply.text, expected);
      assert.equal(fixture.runs[0].intent, "OUT_OF_SCOPE");
      assert.equal(jsonMetadata(fixture.updates[0].metadata).selectedTarget, "out_of_scope");
      assert.equal(requests.length, 1);
      assert.ok(requests[0].url.endsWith("/responses"));
      assert.equal(jsonMetadata(fixture.messages[1].metadata).replyLength, expected.length);
      assert.deepEqual(fixture.workflowCalls, []);
    });
  }

  test(`${channel}: Unknown uses dedicated clarification and returns one tailored question without an inferred answer`, async () => {
    const question = "Which item do you mean by 'that one'?";
    const requests = controlledOpenAi("UNKNOWN", question);
    const fixture = await createConciseChatFixture();
    const reply = await fixture.service.createBotReply({ channel, lineUserId: "synthetic-eval-user", message: "that one" });
    assert.equal(reply.text, question);
    assert.equal(reply.text.match(/\?/g)?.length, 1);
    assert.equal(fixture.runs[0].intent, "UNKNOWN");
    assert.equal(jsonMetadata(fixture.updates[0].metadata).selectedTarget, "unknown");
    assert.equal(requests.filter((request) => request.url.endsWith("/chat/completions")).length, 1);
    assert.match(requests[1].body.messages?.[0].content ?? "", /clarif/i);
    assert.deepEqual(fixture.workflowCalls, []);
  });
}

test("General Chat gives routing one completed turn and generation at most four cross-workflow turns", async () => {
  const history: ConversationMessage[] = [
    { role: "user", content: "Old greeting" }, { role: "assistant", content: "Old answer" },
    { role: "user", content: "Where is the BU library?" }, { role: "assistant", content: "Verified library information." },
    { role: "user", content: "Explain my saved lecture." }, { role: "assistant", content: "Study-memory explanation." },
    { role: "user", content: "Check my ticket." }, { role: "assistant", content: "Ticket workflow answer." },
    { role: "user", content: "I'm still nervous." }, { role: "assistant", content: "Try saying hello first." }
  ];
  const requests = controlledOpenAi("GENERAL_CHAT", "One short next point. Would you like to practice it?");
  const fixture = await createConciseChatFixture({ history });
  await fixture.service.createBotReply({ channel: "web", lineUserId: "synthetic-eval-user", message: "continue" });
  const routerInput = JSON.parse(requests[0].body.input?.[1].content ?? "{}");
  assert.deepEqual(routerInput.context.history, history.slice(-2));
  assert.deepEqual(requests[1].body.messages?.slice(1, -1), history.slice(-8));
  assert.deepEqual(fixture.historyRequests, [{ completed: true, limit: 4 }]);
});

test("General Chat sends the calibrated 8192-token ceiling and preserves a long completed model answer without another call", async () => {
  const answer = "A complete sentence with context. ".repeat(20).trim();
  const requests = controlledOpenAi("GENERAL_CHAT", answer);
  const fixture = await createConciseChatFixture();
  const reply = await fixture.service.createBotReply({ lineUserId: "synthetic-eval-user", message: "Hello" });
  assert.equal(requests[1].body.max_completion_tokens, 8192);
  assert.equal(reply.text, answer);
  assert.ok(reply.text.length > 300);
  assert.equal(requests.length, 2);
  assert.equal(jsonMetadata(fixture.messages[1].metadata).replyLength, answer.length);
});

for (const [intent, message, workflow, expectsRawHistory] of [
  ["ASK_BU_INFO", "Hello! How do I connect to BU Wi-Fi?", "knowledge_base", true],
  ["ASK_STUDY_MEMORY", "Expand the second point from my saved notes.", "study_memory", false],
  ["CREATE_TICKET", "Hi, the classroom air conditioner is broken.", "ticket", false]
] as const) {
  test(`${intent}: actionable workflow keeps its detail and avoids General Chat generation`, async () => {
    const expected = "Required operational detail. ".repeat(20).trim();
    const requests = controlledOpenAi(intent, "Do not replace the verified workflow.");
    const fixture = await createConciseChatFixture({ workflowReply: expected });
    const reply = await fixture.service.createBotReply({ lineUserId: "synthetic-eval-user", message });
    assert.equal(reply.text, expected);
    assert.equal(fixture.runs[0].intent, intent);
    assert.deepEqual(fixture.workflowCalls, [workflow]);
    assert.equal(requests.length, 1);
    assert.deepEqual(
      fixture.historyRequests,
      expectsRawHistory
        ? [{ completed: true, limit: 4 }, { completed: false, limit: 8 }]
        : [{ completed: true, limit: 4 }]
    );
  });
}

test("Unverified BU requests retain the verified-information route, abstain, and ask one useful question", async () => {
  const requests = controlledOpenAi("ASK_BU_INFO", "Invented university policy.");
  const fixture = await createConciseChatFixture({ knowledgeMiss: true });
  const reply = await fixture.service.createBotReply({ lineUserId: "synthetic-eval-user", message: "What is BU's official policy for pets in class?" });
  assert.equal(fixture.runs[0].intent, "ASK_BU_INFO");
  assert.match(reply.text, /verified/i);
  assert.equal(reply.text.match(/\?/g)?.length, 1);
  assert.ok(!reply.text.includes("Invented"));
  assert.equal(requests.filter((request) => request.url.endsWith("/chat/completions")).length, 0);
});

test("an expired knowledge item produces BU Links service links instead of a bare miss", async () => {
  const requests = controlledOpenAi("ASK_BU_INFO", "Invented answer.");
  const url = "https://bulinks.bu.ac.th/tuition-fees/";
  const fixture = await createConciseChatFixture({
    knowledgeMiss: true,
    buLinksLookup: async () => ({ kind: "services", text: `Related pages:\n- Tuition: ${url}`, links: [{ title: "Tuition", url }] })
  });
  const reply = await fixture.service.createBotReply({ lineUserId: "synthetic-eval-user", message: "How much is tuition?" });
  assert.ok(reply.text.includes(url));
  const log = reply.executionLog ?? [];
  const lookup = log.find((entry) => entry.action === "BU Links Lookup");
  assert.deepEqual({ ...lookup, durationMs: undefined }, { action: "BU Links Lookup", status: "applied", durationMs: undefined, details: url });
  assert.ok(typeof lookup?.durationMs === "number" && lookup.durationMs >= 0);
  for (const action of ["Agent Router Decision", "Output"]) {
    const step = log.find((entry) => entry.action === action);
    assert.ok(step?.status && typeof step.durationMs === "number", action);
  }
  assert.ok(!log.some((entry) => entry.action === "Search Fresh Info (Web Search)"));
  assert.equal(requests.filter((request) => request.body.tools?.length).length, 0);
});

test("Static Guide returns complete instructions without routing or answer generation", async () => {
  globalThis.fetch = async () => { throw new Error("Static Guide must not call an AI boundary."); };
  const fixture = await createConciseChatFixture();
  const reply = await fixture.service.createBotReply({ lineUserId: "synthetic-eval-user", message: "อัปโหลดบทเรียน" });
  assert.match(reply.text, /PDF.*DOCX/);
  assert.match(reply.text, /\/addnote/);
  assert.match(reply.text, /Assignment due Friday: create one customer persona\./);
  assert.ok(reply.text.length > 200);
  assert.equal(jsonMetadata(fixture.updates[0].metadata).routerType, "hard_guard");
  assert.deepEqual(fixture.historyRequests, []);
});

test("Progressive Detail preserves the follow-up and previous point at the shared response boundary", async () => {
  const history: ConversationMessage[] = [{ role: "user", content: "I'm nervous about classmates." }, { role: "assistant", content: "Try a greeting or ask about the lesson. Which point?" }];
  const answer = "Ask one small question about today's lesson. Want to draft it together?";
  const requests = controlledOpenAi("GENERAL_CHAT", answer);
  const fixture = await createConciseChatFixture({ history });
  const reply = await fixture.service.createBotReply({ lineUserId: "synthetic-eval-user", message: "Expand the second point." });
  assert.equal(reply.text, answer);
  assert.deepEqual(requests[1].body.messages?.slice(1), [...history, { role: "user", content: "Expand the second point." }]);
});

test("Safety-critical messages reach response policy and are exempt from ordinary generation bound", async () => {
  const answer = "Immediate safety guidance must remain complete. ".repeat(12).trim();
  const requests = controlledOpenAi("OUT_OF_SCOPE", answer, true);
  const fixture = await createConciseChatFixture();
  const reply = await fixture.service.createBotReply({ lineUserId: "synthetic-eval-user", message: "I am about to hurt myself." });
  assert.equal(fixture.runs[0].intent, "GENERAL_CHAT");
  assert.equal(jsonMetadata(fixture.updates[0].metadata).safetyCritical, true);
  assert.equal(requests[1].body.max_completion_tokens, undefined);
  assert.equal(reply.text, answer);
});

test("Ticket hard guards skip router LLM calls unless safety-critical hints appear", async () => {
  globalThis.fetch = async () => { throw new Error("Ordinary ticket hard guard must not call router"); };
  const codeFixture = await createConciseChatFixture();
  const codeReply = await codeFixture.service.createBotReply({ lineUserId: "synthetic-eval-user", message: "เช็คสถานะ BU-TICKET-0001" });
  assert.match(codeReply.text, /BU-TICKET-0001/);
  assert.equal(jsonMetadata(codeFixture.updates[0].metadata).routerType, "hard_guard");
  assert.deepEqual(codeFixture.historyRequests, []);

  const creatingFixture = await createConciseChatFixture({ sessionState: "CREATING_TICKET", workflowReply: "กรุณายืนยันข้อมูล Ticket" });
  const creatingReply = await creatingFixture.service.createBotReply({ lineUserId: "synthetic-eval-user", message: "อาคาร A3 ชั้น 2 ห้อง 204 แอร์เสีย" });
  assert.equal(creatingReply.text, "กรุณายืนยันข้อมูล Ticket");
  assert.equal(jsonMetadata(creatingFixture.updates[0].metadata).routerType, "hard_guard");

  const safetyAnswer = "Please move to safety immediately and contact emergency help.";
  const safetyRequests = controlledOpenAi("GENERAL_CHAT", safetyAnswer, true);
  const safetyFixture = await createConciseChatFixture({ sessionState: "CREATING_TICKET" });
  const safetyReply = await safetyFixture.service.createBotReply({ lineUserId: "synthetic-eval-user", message: "I am about to hurt myself." });
  assert.equal(safetyReply.text, safetyAnswer);
  assert.equal(safetyFixture.runs[0].intent, "GENERAL_CHAT");
  assert.equal(safetyRequests.length, 2);
});

test("Human handoff requests use shared conversational response without claiming an operational transfer", async () => {
  const answer = "Live transfer is unavailable. I can help you find verified BU contact information.";
  const requests = controlledOpenAi("GENERAL_CHAT", answer);
  const fixture = await createConciseChatFixture();
  const reply = await fixture.service.createBotReply({ lineUserId: "synthetic-eval-user", message: "Can I talk to a human operator?" });
  assert.equal(reply.text, answer);
  assert.deepEqual(fixture.workflowCalls, []);
  assert.equal(requests.length, 2);
});

test("Jev safety-critical output survives low ordinary intent probability without losing urgency to fallback", async () => {
  env.AGENT_ROUTER_MODE = "jev";
  env.OPENROUTER_API_KEY = "synthetic-openrouter-key";
  env.JEV_ROUTER_MIN_PROBABILITY = 0.8;
  let calls = 0;
  globalThis.fetch = async (input) => {
    calls += 1;
    assert.equal(input, "https://openrouter.ai/api/alpha/decisions");
    return Response.json({ answers: {
      intent: { type: "choice", choice: "UNKNOWN", probabilities: { UNKNOWN: 0.4 } },
      safetyPolicy: { type: "choice", choice: "safety_critical" }
    } });
  };
  const { classifyWithAgentRouter } = await import("@/src/lib/router/agent-router");
  const decision = await classifyWithAgentRouter("I am in immediate danger.");
  assert.equal(decision.intent, "GENERAL_CHAT");
  assert.equal(decision.selectedTarget, "general_chat");
  assert.equal(decision.safetyCritical, true);
  assert.equal(calls, 1);
});

test("Completed history uses a single SQL CTE join over success-linked user/assistant pairs", async () => {
  const { prisma } = await import("@/lib/prisma");
  const { ChatLogRepository } = await import("@/src/repositories/chat-log.repository");
  const originalQueryRaw = prisma.$queryRaw;
  const originalFindRuns = prisma.botRun.findMany;
  const originalFindMessages = prisma.chatMessage.findMany;
  let queryCalls = 0;
  let capturedSql = "";
  let capturedValues: unknown[] = [];

  prisma.botRun.findMany = (async () => { throw new Error("Must not issue separate botRun.findMany"); }) as unknown as typeof originalFindRuns;
  prisma.chatMessage.findMany = (async () => { throw new Error("Must not issue separate chatMessage.findMany"); }) as unknown as typeof originalFindMessages;
  prisma.$queryRaw = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    queryCalls += 1;
    capturedSql = strings.join("?");
    capturedValues = values;
    return [
      { userContent: "Ticket status", assistantContent: "Completed ticket answer" },
      { userContent: "Study-memory follow-up", assistantContent: "Completed study answer" }
    ];
  }) as unknown as typeof originalQueryRaw;

  try {
    const history = await new ChatLogRepository().getRecentCompletedChatHistory("synthetic-eval-user", 4);
    assert.equal(queryCalls, 1);
    assert.match(capturedSql, /status\s*=\s*'success'/);
    assert.match(capturedSql, /u\.role\s*=\s*'user'/);
    assert.match(capturedSql, /a\.role\s*=\s*'assistant'/);
    assert.deepEqual(capturedValues, ["synthetic-eval-user", 4]);
    assert.deepEqual(history, [
      { role: "user", content: "Ticket status" }, { role: "assistant", content: "Completed ticket answer" },
      { role: "user", content: "Study-memory follow-up" }, { role: "assistant", content: "Completed study answer" }
    ]);
  } finally {
    prisma.$queryRaw = originalQueryRaw;
    prisma.botRun.findMany = originalFindRuns;
    prisma.chatMessage.findMany = originalFindMessages;
  }
});
