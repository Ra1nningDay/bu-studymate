import assert from "node:assert/strict";
import { afterEach, before, test } from "node:test";
import type { KnowledgeEvidence } from "@/src/repositories/knowledge.repository";

let env: typeof import("@/src/config/env").env;
let KnowledgeService: typeof import("./knowledge.service").KnowledgeService;
let createFixture: typeof import("../../evals/concise-chat/fixtures").createConciseChatFixture;
const originalFetch = globalThis.fetch;

before(async () => {
  process.env.DATABASE_URL ??= "postgresql://fixture:fixture@localhost:5432/unused";
  ({ env } = await import("@/src/config/env"));
  ({ KnowledgeService } = await import("./knowledge.service"));
  ({ createConciseChatFixture: createFixture } = await import("../../evals/concise-chat/fixtures"));
});
afterEach(() => { globalThis.fetch = originalFetch; });

const evidence: KnowledgeEvidence[] = Array.from({ length: 6 }, (_, i) => ({
  id: `chunk-${i}`, documentId: `doc-${i}`, title: "Fixture Wi-Fi", category: "IT",
  content: "ติดต่อฝ่าย IT", keywords: ["Wi-Fi"], source: "https://bu.ac.th/fixture",
  sourceUrl: "https://bu.ac.th/fixture", created_at: "2026-10-31", updated_at: "2026-10-31",
  verifiedAt: new Date("2026-10-31"), validFrom: null, validUntil: null, score: 1, similarity: 1
}));

for (const miss of [false, true]) test(`per-call usage survives RAG ${miss ? "miss plus web-search fallback" : "answer"} without duplicate totals`, async () => {
  env.OPENAI_API_KEY = "fixture-key";
  env.OPENROUTER_API_KEY = "fixture-key";
  env.AGENT_ROUTER_MODE = "jev";
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("openrouter.ai")) return Response.json({
      model: "typesafe/jev-1.13-20260917",
      answers: { intent: { type: "choice", choice: "ASK_BU_INFO", probabilities: { ASK_BU_INFO: 0.99 } },
        safetyPolicy: { type: "choice", choice: "ordinary" } },
      usage: { input_tokens: 100, output_tokens: 20, cost: 0.0000042 }
    });
    if (String(url).endsWith("/responses")) return Response.json({
      model: "gpt-6-luna", output_text: "VERIFIED_SOURCE_NOT_FOUND",
      output: [{ type: "web_search_call" }, { type: "web_search_call" }],
      usage: { total_tokens: 60, input_tokens: 50, output_tokens: 10, input_tokens_details: { cached_tokens: 30 } }
    });
    const body = JSON.parse(String(init?.body));
    const name = body.response_format.json_schema.name;
    const answer = name === "knowledge_query" ? { query: "Wi-Fi iPhone" }
      : name === "knowledge_ranking" ? { evidenceIds: evidence.slice(0, 5).map(item => item.id) }
        : { answer: miss ? "NO_VERIFIED_INFO_FOUND" : "ติดต่อฝ่าย IT ครับ", evidenceIds: miss ? [] : ["chunk-0"] };
    return Response.json({ model: "gpt-6-luna", choices: [{ finish_reason: "stop", message: { content: JSON.stringify(answer) } }],
      usage: { total_tokens: 30, prompt_tokens: 20, completion_tokens: 10, prompt_tokens_details: { cached_tokens: 5 } } });
  };
  const knowledge = new KnowledgeService({ hasIndexedEvidence: async () => true, hybridSearch: async () => evidence },
    async () => ({ vectors: [[1]], usage: { total_tokens: 7 }, model: "text-embedding-3-small" }));
  const fixture = await createFixture({ knowledgeService: knowledge, history: [{ role: "user", content: "Wi-Fi ใช้ยังไง" }] });
  await fixture.service.createBotReply({ channel: "web", lineUserId: "fixture", message: "แล้ว iPhone ล่ะ" });
  assert.deepEqual(fixture.tokenLogs.map(log => log.step), ["router", "query_rewrite", "embedding", "rerank", "answer", ...(miss ? ["web_search_preview"] : [])]);
  assert.equal(fixture.tokenLogs[0].provider, "openrouter");
  assert.equal(fixture.tokenLogs[0].costUsd, 0.0000042);
  assert.equal(fixture.tokenLogs[2].model, "text-embedding-3-small");
  assert.equal(fixture.tokenLogs[2].promptTokens, 7);
  assert.equal(fixture.tokenLogs[3].cachedTokens, 5);
  assert.equal(fixture.tokenLogs.reduce((sum, log) => sum + log.totalTokens!, 0), miss ? 277 : 217);
  assert.equal((fixture.updates.at(-1)?.metadata as { tokensUsed: number }).tokensUsed, miss ? 277 : 217);
  if (miss) {
    const search = fixture.tokenLogs.at(-1)!;
    assert.equal(search.promptTokens, 50);
    assert.equal(search.cachedTokens, 30);
    assert.equal(search.webSearchCalls, 2);
  }
});
