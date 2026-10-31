import assert from "node:assert/strict";
import { afterEach, before, test } from "node:test";

let env: typeof import("@/src/config/env").env;
let classifyWithAgentRouter: typeof import("@/lib/agent-router").classifyWithAgentRouter;
const originalFetch = globalThis.fetch;
const originalInfo = console.info;

before(async () => {
  process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/studymate_test";
  ({ env } = await import("@/src/config/env"));
  ({ classifyWithAgentRouter } = await import("@/lib/agent-router"));
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  console.info = originalInfo;
  env.AGENT_ROUTER_MODE = "openai";
});

function openAiResponse(intent: "ASK_BU_INFO" | "CREATE_TICKET") {
  return Response.json({
    model: "gpt-6-luna",
    output_text: JSON.stringify({
      confidence: 0.9,
      intent,
      needsWebSearch: false,
      safetyCritical: false,
      reason: "Test route",
      selectedTarget: intent === "CREATE_TICKET" ? "ticket" : "knowledge_base"
    })
  });
}

function jevResponse(intent: "ASK_FRESH_INFO" | "CREATE_TICKET", probability: number) {
  return Response.json({
    model: "typesafe/jev-1.13-20260917",
    answers: {
      intent: {
        type: "choice",
        choice: intent,
        confidence: probability,
        probabilities: { [intent]: probability }
      },
      safetyPolicy: { type: "choice", choice: "ordinary" }
    },
    usage: { input_tokens: 100, output_tokens: 20, cost: 0.0000042 }
  });
}

test("Jev routes fresh information using the Decisions API and local policy", async () => {
  env.AGENT_ROUTER_MODE = "jev";
  env.OPENROUTER_API_KEY = "test-openrouter-key";
  env.JEV_ROUTER_MIN_PROBABILITY = 0.8;
  let calls = 0;

  globalThis.fetch = async (input, init) => {
    calls += 1;
    assert.equal(input, "https://openrouter.ai/api/alpha/decisions");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, "typesafe/jev-1.13");
    assert.equal(body.state.message, "วันนี้ BU เปิดไหม");
    assert.equal(body.questions.intent.type, "choice");
    assert.ok(body.questions.intent.criteria.ASK_FRESH_INFO);
    return jevResponse("ASK_FRESH_INFO", 0.94);
  };

  const decision = await classifyWithAgentRouter("วันนี้ BU เปิดไหม");
  assert.equal(calls, 1);
  assert.equal(decision.intent, "ASK_FRESH_INFO");
  assert.equal(decision.selectedTarget, "web_search");
  assert.equal(decision.needsWebSearch, true);
  assert.equal(decision.confidence, 0.94);
  assert.equal(decision.usage?.total_tokens, 120);
  assert.equal(decision.usage?.prompt_tokens, 100);
  assert.equal(decision.usage?.completion_tokens, 20);
  assert.equal(decision.usageEntries?.[0].provider, "openrouter");
  assert.equal(decision.usageEntries?.[0].usage.cost, 0.0000042);
});

test("Jev falls back to OpenAI when its probability is below the configured threshold", async () => {
  env.AGENT_ROUTER_MODE = "jev";
  env.OPENROUTER_API_KEY = "test-openrouter-key";
  env.OPENAI_API_KEY = "test-openai-key";
  env.JEV_ROUTER_MIN_PROBABILITY = 0.8;
  const calls: string[] = [];

  globalThis.fetch = async (input) => {
    calls.push(String(input));
    return String(input).includes("openrouter.ai")
      ? jevResponse("CREATE_TICKET", 0.62)
      : openAiResponse("ASK_BU_INFO");
  };

  const decision = await classifyWithAgentRouter("BU Wi-Fi ใช้ยังไง");
  assert.equal(decision.intent, "ASK_BU_INFO");
  assert.equal(decision.selectedTarget, "knowledge_base");
  assert.equal(calls.length, 2);
  assert.equal(decision.usageEntries?.[0].provider, "openrouter");
});

test("Jev falls back to OpenAI on malformed output", async () => {
  env.AGENT_ROUTER_MODE = "jev";
  env.OPENROUTER_API_KEY = "test-openrouter-key";
  env.OPENAI_API_KEY = "test-openai-key";

  globalThis.fetch = async (input) =>
    String(input).includes("openrouter.ai")
      ? Response.json({ answers: { intent: { type: "choice", choice: "CREATE_TICKET" } } })
      : openAiResponse("ASK_BU_INFO");

  const decision = await classifyWithAgentRouter("BU Wi-Fi ใช้ยังไง");
  assert.equal(decision.intent, "ASK_BU_INFO");
});

test("Jev falls back to OpenAI when its request fails", async () => {
  env.AGENT_ROUTER_MODE = "jev";
  env.OPENROUTER_API_KEY = "test-openrouter-key";
  env.OPENAI_API_KEY = "test-openai-key";

  globalThis.fetch = async (input) => {
    if (String(input).includes("openrouter.ai")) {
      throw new Error("Network unavailable");
    }
    return openAiResponse("CREATE_TICKET");
  };

  const decision = await classifyWithAgentRouter("แอร์ห้องเรียนเสีย");
  assert.equal(decision.intent, "CREATE_TICKET");
  assert.equal(decision.selectedTarget, "ticket");
});

test("shadow mode keeps OpenAI's decision and logs no student message", async () => {
  env.AGENT_ROUTER_MODE = "shadow";
  env.OPENROUTER_API_KEY = "test-openrouter-key";
  env.OPENAI_API_KEY = "test-openai-key";
  const logs: unknown[][] = [];
  console.info = (...args) => { logs.push(args); };

  globalThis.fetch = async (input) =>
    String(input).includes("openrouter.ai")
      ? jevResponse("CREATE_TICKET", 0.93)
      : openAiResponse("ASK_BU_INFO");

  const decision = await classifyWithAgentRouter("private student message");
  assert.equal(decision.intent, "ASK_BU_INFO");
  assert.equal((logs[0]?.[1] as { agreed: boolean }).agreed, false);
  assert.equal(JSON.stringify(logs).includes("private student message"), false);
  assert.equal(decision.usageEntries?.at(-1)?.provider, "openrouter");
});
