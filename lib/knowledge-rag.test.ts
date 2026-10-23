import assert from "node:assert/strict";
import { afterEach, before, test } from "node:test";
import { KnowledgeManifestSchema } from "@/src/dtos/knowledge.dto";
import { knowledgeContentHash, splitKnowledgeContent, tokenizeKnowledge } from "@/lib/knowledge-index";
import { fetchKnowledgeSource, isPublicKnowledgeAddress } from "@/lib/knowledge-source";
import type { KnowledgeEvidence, KnowledgeRepository } from "@/src/repositories/knowledge.repository";

let env: typeof import("@/src/config/env").env;
let embedding: typeof import("@/lib/knowledge-embedding");
let KnowledgeService: typeof import("@/src/services/knowledge.service").KnowledgeService;
let KnowledgeIngestionService: typeof import("@/src/services/knowledge-ingestion.service").KnowledgeIngestionService;
let rewrite: typeof import("@/lib/ai").rewriteKnowledgeAnswer;
let rerank: typeof import("@/lib/knowledge-rerank").rerankKnowledge;
let rewriteQuery: typeof import("@/lib/knowledge-query").rewriteKnowledgeQuery;
const originalFetch = globalThis.fetch;
const vector = [1, ...Array<number>(1535).fill(0)];
const now = new Date("2026-10-13T00:00:00Z");
const reviewed = {
  title: "Synthetic Registrar", category: "Synthetic test", content: "ขอเอกสารผ่านระบบทดสอบ",
  keywords: ["เอกสาร", "IT232"], sourceUrl: "https://bu.ac.th/synthetic-test",
  sourceHash: "a".repeat(64), verifiedBy: "Synthetic fixture only",
  verifiedAt: "2026-10-12T00:00:00Z", reviewAfter: "2099-01-01T00:00:00Z"
};
const evidence: KnowledgeEvidence[] = ["one", "two"].map((id) => ({
  id, documentId: id, title: reviewed.title, category: reviewed.category, content: reviewed.content,
  keywords: reviewed.keywords, source: reviewed.sourceUrl, sourceUrl: `${reviewed.sourceUrl}/${id}`,
  created_at: now.toISOString(), updated_at: now.toISOString(), verifiedAt: now,
  validFrom: null, validUntil: null, score: 0.02, similarity: 0.8, keywordRank: 1, vectorRank: 1
}));

before(async () => {
  process.env.DATABASE_URL ??= "postgresql://fixture:fixture@localhost:5432/fixture_unused";
  ({ env } = await import("@/src/config/env"));
  env.OPENAI_API_KEY = "synthetic-key";
  embedding = await import("@/lib/knowledge-embedding");
  ({ KnowledgeService } = await import("@/src/services/knowledge.service"));
  ({ KnowledgeIngestionService } = await import("@/src/services/knowledge-ingestion.service"));
  ({ rewriteKnowledgeAnswer: rewrite } = await import("@/lib/ai"));
  ({ rerankKnowledge: rerank } = await import("@/lib/knowledge-rerank"));
  ({ rewriteKnowledgeQuery: rewriteQuery } = await import("@/lib/knowledge-query"));
});
afterEach(() => { globalThis.fetch = originalFetch; env.CRON_SECRET = undefined; env.OPENAI_API_KEY = "synthetic-key"; });

const fakeEmbed = async () => ({ vectors: [vector], usage: { total_tokens: 1 }, model: "text-embedding-3-small" as const });

test("Thai without spaces, English and course codes share normalized word tokens", () => {
  const indexed = tokenizeKnowledge("ขอเอกสารผ่านระบบ Wi-Fi IT232").split(" ");
  for (const term of tokenizeKnowledge("เอกสาร IT232").split(" ")) assert.ok(indexed.includes(term));
  assert.equal(tokenizeKnowledge("ＢＵ Wi-Fi"), tokenizeKnowledge("bu wi-fi"));
});

test("long content is bounded without dropping characters or splitting Unicode pairs", () => {
  const text = "เอกสาร😀".repeat(450);
  const chunks = splitKnowledgeContent(text);
  assert.equal(chunks.join(""), text);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => Array.from(chunk).length <= 1200 && !chunk.includes("\uFFFD")));
});

test("manifest rejects unofficial URLs, duplicate titles, bad dates and missing approval", () => {
  assert.equal(KnowledgeManifestSchema.safeParse([reviewed]).success, true);
  for (const change of [
    { sourceUrl: "https://bu.ac.th.attacker.test/page" }, { sourceUrl: "http://bu.ac.th/page" },
    { sourceUrl: "https://user:password@bu.ac.th/page" }, { sourceUrl: "https://bu.ac.th:8080/page" },
    { verifiedBy: "" }, { sourceHash: "unknown" }, { reviewAfter: reviewed.verifiedAt },
    { validFrom: "2026-10-15T00:00:00Z", validUntil: "2026-10-14T00:00:00Z" }
  ]) assert.equal(KnowledgeManifestSchema.safeParse([{ ...reviewed, ...change }]).success, false);
  assert.equal(KnowledgeManifestSchema.safeParse([reviewed, reviewed]).success, false);
});

test("embedding validates dimensions/model/indices and sends the existing 1536 format", async () => {
  let body: Record<string, unknown> = {};
  globalThis.fetch = async (_url, init) => {
    body = JSON.parse(String(init?.body));
    return Response.json({ model: "text-embedding-3-small", data: [{ index: 0, embedding: vector }], usage: { total_tokens: 2 } });
  };
  assert.equal((await embedding.embedKnowledge(["เอกสาร"])).vectors[0].length, 1536);
  assert.equal(body.dimensions, 1536);
  assert.equal(body.encoding_format, "float");
  await assert.rejects(() => embedding.embedKnowledge(["x".repeat(7501)]));
  for (const response of [
    { model: "other", data: [{ index: 0, embedding: vector }] },
    { model: "text-embedding-3-small", data: [{ index: 0, embedding: [1, 2] }] },
    { model: "text-embedding-3-small", data: [{ index: 1, embedding: vector }] },
    { model: "text-embedding-3-small", data: [{ index: 0, embedding: Array(1536).fill(0) }] }
  ]) {
    globalThis.fetch = async () => Response.json({ ...response, usage: { total_tokens: 1 } });
    await assert.rejects(() => embedding.embedKnowledge(["เอกสาร"]));
  }
});

test("source retrieval rejects private DNS and revalidates every redirect before sending", async () => {
  for (const address of ["127.0.0.1", "10.1.1.1", "169.254.169.254", "100.64.0.1", "::1", "fd00::1", "::ffff:127.0.0.1"]) {
    assert.equal(isPublicKnowledgeAddress(address), false);
  }
  assert.equal(isPublicKnowledgeAddress("8.8.8.8"), true);
  let requests = 0;
  const request = async () => { requests++; return { status: 302, location: "https://attacker.test/", body: Buffer.from("") }; };
  await assert.rejects(() => fetchKnowledgeSource(reviewed.sourceUrl, {
    lookup: async () => [{ address: "127.0.0.1", family: 4 }], request
  }));
  assert.equal(requests, 0);
  await assert.rejects(() => fetchKnowledgeSource(reviewed.sourceUrl, {
    lookup: async () => [{ address: "8.8.8.8", family: 4 }], request
  }));
  assert.equal(requests, 1);
});

test("unchanged import reuses embeddings; approval cannot be renewed by a failed source check", async () => {
  const item = KnowledgeManifestSchema.parse([reviewed])[0];
  let embedded = 0;
  let saved = 0;
  const records: string[] = [];
  const repo = {
    findIndexedDocument: async () => ({ ...item, contentHash: knowledgeContentHash(item),
      chunks: [{ content: item.content, embeddingModel: "text-embedding-3-small" }] }) as unknown as Awaited<ReturnType<KnowledgeRepository["findIndexedDocument"]>>,
    saveReviewedDocument: async (_item: unknown, passages: unknown) => { assert.equal(passages, null); saved++; return "one"; },
    listSourcesForCheck: async () => [{ id: "one", sourceUrl: item.sourceUrl, sourceHash: item.sourceHash, reviewAfter: item.reviewAfter }],
    recordSourceCheck: async (_id: string, hash: string, status: string) => { assert.equal(hash, item.sourceHash); records.push(status); return { count: 1 }; },
    listOverdueFileDocuments: async () => []
  };
  const service = new KnowledgeIngestionService(repo, async () => { embedded++; return fakeEmbed(); },
    async () => ({ sourceHash: item.sourceHash, finalUrl: item.sourceUrl }));
  assert.equal((await service.importManifest([reviewed], now))[0].embedded, false);
  assert.equal(embedded, 0);
  assert.equal(saved, 1);
  const failing = new KnowledgeIngestionService(repo, fakeEmbed, async () => { throw new Error("offline"); });
  await failing.checkSources();
  assert.deepEqual(records, ["UNAVAILABLE"]);
  assert.equal(item.verifiedAt.getTime(), new Date(reviewed.verifiedAt).getTime());
});

test("changed source, failed embeddings and future approval cannot replace previous evidence", async () => {
  let saved = 0;
  const repo = {
    findIndexedDocument: async () => null,
    saveReviewedDocument: async () => { saved++; return "one"; },
    listSourcesForCheck: async () => [], recordSourceCheck: async () => ({ count: 0 }), listOverdueFileDocuments: async () => []
  };
  const changed = new KnowledgeIngestionService(repo, fakeEmbed, async () => ({ sourceHash: "b".repeat(64), finalUrl: reviewed.sourceUrl }));
  await assert.rejects(() => changed.importManifest([reviewed], now), /Source changed/);
  const failing = new KnowledgeIngestionService(repo, async () => { throw new Error("offline"); },
    async () => ({ sourceHash: reviewed.sourceHash, finalUrl: reviewed.sourceUrl }));
  await assert.rejects(() => failing.importManifest([reviewed], now), /offline/);
  await assert.rejects(() => failing.importManifest([{ ...reviewed, verifiedAt: "2027-01-01T00:00:00Z" }], now), /future/);
  assert.equal(saved, 0);
});

test("answer cites only selected retrieved IDs and rejects invented citations or raw URLs", async () => {
  for (const [answer, evidenceIds, expectedMiss] of [
    ["คำตอบจากข้อมูลทดสอบ", ["two"], false], ["คำตอบ", ["invented"], true],
    ["คำตอบ", [], true], ["https://attacker.test", ["one"], true],
    ["NO_VERIFIED_INFO_FOUND", [], true]
  ] as const) {
    globalThis.fetch = async () => Response.json({ choices: [{ message: { content: JSON.stringify({ answer, evidenceIds }) } }], usage: { total_tokens: 1 }, model: "synthetic" });
    const result = await rewrite({ evidence, question: "เอกสาร" });
    assert.equal(result.text === "NO_VERIFIED_INFO_FOUND", expectedMiss);
    assert.deepEqual(result.sources, expectedMiss ? [] : [{ title: reviewed.title, url: evidence[1].sourceUrl }]);
  }
});

test("embedding outage uses keyword evidence; empty/unsafe evidence remains a miss", async () => {
  let received: number[] | null | undefined;
  const service = new KnowledgeService({ hasIndexedEvidence: async () => true, hybridSearch: async (_query, input) => { received = input; return []; } },
    async () => { throw new Error("offline"); });
  assert.equal((await service.answerQuestion("เอกสาร")).isMiss, true);
  assert.equal(received, null);
  const unsafe = new KnowledgeService({ hasIndexedEvidence: async () => true, hybridSearch: async () => [{ ...evidence[0], sourceUrl: "https://attacker.test" }] }, fakeEmbed);
  assert.equal((await unsafe.answerQuestion("เอกสาร")).isMiss, true);
});

test("answer provider outage abstains and successful replies include embedding/rerank token usage", async () => {
  globalThis.fetch = async () => new Response(null, { status: 503 });
  const service = new KnowledgeService({ hasIndexedEvidence: async () => true, hybridSearch: async () => evidence }, fakeEmbed,
    async () => { throw new Error("provider timeout"); });
  const miss = await service.answerQuestion("เอกสาร");
  assert.equal(miss.isMiss, true);
  assert.deepEqual(miss.sources, []);
  assert.equal(miss.usage?.total_tokens, 1);
  globalThis.fetch = async (_url, init) => {
    const ranking = JSON.parse(String(init?.body)).response_format?.json_schema?.name === "knowledge_ranking";
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(ranking
      ? { evidenceIds: ["one", "two"] } : { answer: "คำตอบ", evidenceIds: ["one"] }) } }], usage: { total_tokens: ranking ? 3 : 12 } });
  };
  const answered = await new KnowledgeService({ hasIndexedEvidence: async () => true, hybridSearch: async () => evidence }, fakeEmbed).answerQuestion("เอกสาร");
  assert.equal(answered.usage?.total_tokens, 16);
  assert.equal(answered.retrievalModel, "text-embedding-3-small");
  assert.equal(answered.rerankStatus, "applied");
});

test("reranker promotes an original rank-eight passage before answering and filters unofficial candidates", async () => {
  const candidates = Array.from({ length: 8 }, (_, index) => ({ ...evidence[0], id: `chunk-${index}`, content: `passage-${index}` }));
  const ids = ["chunk-7", "chunk-3", "chunk-2", "chunk-1", "chunk-0"];
  let calls = 0;
  globalThis.fetch = async (_url, init) => {
    calls++;
    assert.ok(init?.signal);
    const body = JSON.parse(String(init?.body));
    const payload = JSON.parse(body.messages.at(-1).content);
    assert.equal(body.model, env.OPENAI_MODEL);
    assert.equal(body.response_format.json_schema.strict, true);
    if (body.response_format.json_schema.name === "knowledge_ranking") {
      assert.deepEqual(payload.evidence.map((item: { id: string }) => item.id), candidates.map((item) => item.id));
      assert.equal(payload.question, "เอกสาร IT232");
      return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ evidenceIds: ids }) } }], usage: { total_tokens: 3 }, model: "synthetic-reranker" });
    }
    assert.deepEqual(payload.evidence.map((item: { id: string }) => item.id), ids);
    assert.equal(payload.evidence[0].content, "passage-7");
    return Response.json({ choices: [{ message: { content: JSON.stringify({ answer: "คำตอบทดสอบ", evidenceIds: ["chunk-7"] }) } }], usage: { total_tokens: 12 } });
  };
  const service = new KnowledgeService({ hasIndexedEvidence: async () => true, hybridSearch: async () => [
    ...candidates, { ...evidence[0], id: "unsafe", sourceUrl: "https://attacker.test" }
  ] }, fakeEmbed);
  const result = await service.answerQuestion("เอกสาร IT232");
  assert.equal(result.isMiss, false);
  assert.equal(result.rerankModel, "synthetic-reranker");
  assert.equal(result.rerankStatus, "applied");
  assert.equal(result.usage?.total_tokens, 16);
  assert.equal(calls, 2);
  assert.deepEqual(result.sources, [{ title: candidates[7].title, url: candidates[7].sourceUrl }]);
  assert.deepEqual(result.trace.map((step) => step.action), ["Query Rewrite", "Hybrid Retrieval", "RRF Fusion", "Reranker", "LLM Generation"]);
  assert.equal(result.trace[0].status, "skipped");
  assert.equal(result.trace[1].rag?.keywordCount, 9);
  assert.equal(result.trace[2].durationMs, undefined);
  assert.ok(result.trace[2].details?.includes("SQL"));
  const selected = result.trace[3].rag?.chunks?.[0];
  assert.equal(selected?.id, "chunk-7");
  assert.equal(selected?.rank, 8);
  assert.equal(selected?.selectedRank, 1);
  assert.equal(selected?.rrfScore, candidates[7].score);
  assert.equal(result.trace[4].rag?.tokens, 12);
  for (const step of result.trace.filter((step) => step.durationMs !== undefined)) assert.ok(step.durationMs! >= 0);
});

test("invalid rankings, refusal and truncation preserve RRF Top 5 and reported usage", async () => {
  const candidates = Array.from({ length: 8 }, (_, index) => ({ ...evidence[0], id: `chunk-${index}` }));
  const ids = candidates.slice(0, 5).map((item) => item.id);
  for (const change of [
    { content: "not JSON" }, { content: JSON.stringify({ evidenceIds: ["invented", ...ids.slice(1)] }) },
    { content: JSON.stringify({ evidenceIds: [ids[0], ids[0], ...ids.slice(2)] }) },
    { content: JSON.stringify({ evidenceIds: ids.slice(0, 4) }) },
    { content: JSON.stringify({ evidenceIds: [...ids, "chunk-5"] }) },
    { content: JSON.stringify({ evidenceIds: ids, extra: "unexpected" }) },
    { finish_reason: "length" }, { refusal: "refused", content: null }
  ]) {
    const { finish_reason = "stop", ...message } = change;
    globalThis.fetch = async () => Response.json({ choices: [{ finish_reason,
      message: { content: JSON.stringify({ evidenceIds: ids }), ...message } }], usage: { total_tokens: 2 }, model: "synthetic-reranker" });
    const ranked = await rerank("เอกสาร", candidates);
    assert.equal(ranked.status, "fallback");
    assert.deepEqual(ranked.items, candidates.slice(0, 5));
    assert.equal(ranked.usage?.total_tokens, 2);
  }
});

test("reranker bounds candidates and skips empty/single input or missing credentials", async () => {
  globalThis.fetch = async () => { throw new Error("Must not call provider"); };
  for (const items of [[], [evidence[0]]]) {
    const ranked = await rerank("เอกสาร", items);
    assert.equal(ranked.status, "skipped");
    assert.deepEqual(ranked.items, items);
  }
  env.OPENAI_API_KEY = undefined;
  assert.equal((await rerank("เอกสาร", evidence)).status, "fallback");
  env.OPENAI_API_KEY = "synthetic-key";
  const candidates = Array.from({ length: 45 }, (_, index) => ({ ...evidence[0], id: `chunk-${index}` }));
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(JSON.parse(body.messages.at(-1).content).evidence.length, 40);
    return Response.json({ choices: [{ finish_reason: "stop", message: {
      content: JSON.stringify({ evidenceIds: candidates.slice(35, 40).map((item) => item.id) })
    } }] });
  };
  assert.deepEqual((await rerank("เอกสาร", candidates)).items, candidates.slice(35, 40));
});

test("rerank HTTP errors, malformed envelopes and timeouts preserve original evidence", async () => {
  for (const fetcher of [
    async () => new Response(null, { status: 429 }),
    async () => Response.json({ choices: "invalid" }),
    async () => { throw new DOMException("Timed out", "TimeoutError"); }
  ]) {
    globalThis.fetch = fetcher;
    const result = await rerank("เอกสาร", evidence);
    assert.equal(result.status, "fallback");
    assert.deepEqual(result.items, evidence);
  }
});

test("rejected ranking output still contributes reported usage to the final answer", async () => {
  globalThis.fetch = async () => Response.json({ choices: "invalid", usage: { total_tokens: 4 }, model: "synthetic-reranker" });
  const service = new KnowledgeService({ hasIndexedEvidence: async () => true, hybridSearch: async () => evidence }, fakeEmbed,
    async ({ evidence: selected }) => {
      assert.deepEqual(selected, evidence);
      return { text: "คำตอบทดสอบ", sources: [], usage: { total_tokens: 2 }, model: "synthetic-answer" };
    });
  const result = await service.answerQuestion("เอกสาร");
  assert.equal(result.isMiss, false);
  assert.equal(result.rerankStatus, "fallback");
  assert.equal(result.usage?.total_tokens, 7);
});

test("follow-up rewrite feeds embeddings, hybrid retrieval and reranker but preserves the original answer question", async () => {
  const query = "แล้วใช้กับ iPhone ล่ะ";
  const standalone = "ลงทะเบียน Wi-Fi มหาวิทยาลัยกรุงเทพบน iPhone ยังไง";
  const history = [{ role: "user" as const, content: "ลงทะเบียน Wi-Fi ยังไง" },
    { role: "assistant" as const, content: "ข้อมูลจากคู่มือ Wi-Fi ทดสอบ" }];
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    const input = JSON.parse(body.messages.at(-1).content);
    assert.equal(body.response_format.json_schema.name, "knowledge_query");
    assert.equal(input.question, query);
    assert.deepEqual(input.history, history);
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ query: standalone }) } }],
      usage: { total_tokens: 5 }, model: "synthetic-rewriter" });
  };
  const stages: string[] = [];
  const service = new KnowledgeService({ hasIndexedEvidence: async () => true,
    hybridSearch: async (search, input) => { stages.push("search"); assert.equal(search, standalone); assert.deepEqual(input, vector); return evidence; }
  }, async (input) => { stages.push("embed"); assert.deepEqual(input, [standalone]); return fakeEmbed(); },
  async (input) => {
    stages.push("answer"); assert.equal(input.question, query); assert.deepEqual(input.history, history);
    return { text: "คำตอบ", sources: [], usage: { total_tokens: 12 }, model: "synthetic-answer" };
  }, async (search, candidates) => {
    stages.push("rerank"); assert.equal(search, standalone); assert.deepEqual(candidates, evidence);
    return { items: candidates, usage: { total_tokens: 3 }, model: "synthetic-reranker", status: "applied" };
  });
  const result = await service.answerQuestion(query, history);
  assert.deepEqual(stages, ["embed", "search", "rerank", "answer"]);
  assert.equal(result.queryRewriteStatus, "applied");
  assert.equal(result.queryRewriteModel, "synthetic-rewriter");
  assert.equal(result.usage?.total_tokens, 21);
  assert.equal(result.trace[0].rag?.originalQuery, query);
  assert.equal(result.trace[0].rag?.query, standalone);
  assert.equal(result.trace[0].rag?.tokens, 5);
});

test("query rewrite bounds history to eight messages and 1200 Unicode characters each", async () => {
  const history = Array.from({ length: 12 }, (_, index) => ({ role: "user" as const, content: `${index}:` + "😀".repeat(1500) }));
  globalThis.fetch = async (_url, init) => {
    assert.ok(init?.signal);
    const body = JSON.parse(String(init?.body));
    const input = JSON.parse(body.messages.at(-1).content);
    assert.equal(body.model, env.OPENAI_MODEL);
    assert.equal(body.response_format.json_schema.strict, true);
    assert.equal(input.history.length, 8);
    assert.ok(input.history[0].content.startsWith("4:"));
    assert.ok(input.history.every((item: { content: string }) => Array.from(item.content).length === 1200 && !item.content.includes("\uFFFD")));
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ query: " English course IT232 in 2026 " }) } }] });
  };
  assert.equal((await rewriteQuery("English course IT232 in 2026", history)).query, "English course IT232 in 2026");
});

test("invalid rewrite, refusal and truncation fall back to the original query and retain usage", async () => {
  const history = [{ role: "user" as const, content: "Wi-Fi" }];
  for (const change of [
    { content: "invalid JSON" }, { content: JSON.stringify({ query: " " }) },
    { content: JSON.stringify({ query: "ก".repeat(2501) }) }, { content: JSON.stringify({ query: 42 }) },
    { content: JSON.stringify({ query: "Wi-Fi", answer: "extra" }) },
    { finish_reason: "length" }, { refusal: "refused", content: null }
  ]) {
    const { finish_reason = "stop", ...message } = change;
    globalThis.fetch = async () => Response.json({ choices: [{ finish_reason,
      message: { content: JSON.stringify({ query: "Wi-Fi บน iPhone" }), ...message } }], usage: { total_tokens: 4 } });
    const result = await rewriteQuery("แล้ว iPhone ล่ะ", history);
    assert.equal(result.status, "fallback");
    assert.equal(result.query, "แล้ว iPhone ล่ะ");
    assert.equal(result.usage?.total_tokens, 4);
  }
});

test("rewrite skips first turns and safely falls back on missing key, HTTP errors and timeouts", async () => {
  const history = [{ role: "user" as const, content: "Wi-Fi" }];
  globalThis.fetch = async () => { throw new Error("Must not call provider"); };
  assert.equal((await rewriteQuery("Wi-Fi")).status, "skipped");
  env.OPENAI_API_KEY = undefined;
  assert.equal((await rewriteQuery("แล้ว iPhone ล่ะ", history)).status, "fallback");
  env.OPENAI_API_KEY = "synthetic-key";
  for (const fetcher of [async () => new Response(null, { status: 503 }),
    async () => { throw new DOMException("Timed out", "TimeoutError"); }]) {
    globalThis.fetch = fetcher;
    const result = await rewriteQuery("แล้ว iPhone ล่ะ", history);
    assert.equal(result.query, "แล้ว iPhone ล่ะ");
    assert.equal(result.status, "fallback");
  }
});

test("failed rewrite and embedding still search the original keyword query and count rewrite usage", async () => {
  globalThis.fetch = async () => Response.json({ choices: "invalid", usage: { total_tokens: 4 } });
  const service = new KnowledgeService({ hasIndexedEvidence: async () => true,
    hybridSearch: async (query, input) => { assert.equal(query, "แล้ว iPhone ล่ะ"); assert.equal(input, null); return [evidence[0]]; }
  }, async (input) => { assert.deepEqual(input, ["แล้ว iPhone ล่ะ"]); throw new Error("embedding unavailable"); },
  async () => ({ text: "คำตอบ", sources: [], usage: { total_tokens: 2 }, model: "synthetic-answer" }));
  const result = await service.answerQuestion("แล้ว iPhone ล่ะ", [{ role: "user", content: "Wi-Fi" }]);
  assert.equal(result.queryRewriteStatus, "fallback");
  assert.equal(result.usage?.total_tokens, 6);
  assert.equal(result.trace[0].status, "fallback");
  assert.equal(result.trace[1].status, "fallback");
  assert.equal(result.trace[3].status, "skipped");
});

for (const channel of ["line", "web"] as const) {
  test(`${channel}: real knowledge flow propagates citations to replies and saved runs`, async () => {
    env.AGENT_ROUTER_MODE = "openai";
    const history = [{ role: "user" as const, content: "ลงทะเบียน Wi-Fi ยังไง" },
      { role: "assistant" as const, content: "ข้อมูลจากคู่มือทดสอบ" }];
    globalThis.fetch = async (url, init) => String(url).endsWith("/responses")
      ? Response.json({ output_text: JSON.stringify({ intent: "ASK_BU_INFO", selectedTarget: "knowledge_base", confidence: 0.99, needsWebSearch: false, reason: "synthetic" }) })
      : Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(
        JSON.parse(String(init?.body)).response_format?.json_schema?.name === "knowledge_query"
          ? { query: "ลงทะเบียน Wi-Fi บน iPhone ยังไง" }
          : JSON.parse(String(init?.body)).response_format?.json_schema?.name === "knowledge_ranking"
            ? { evidenceIds: ["two", "one"] } : { answer: "คำตอบทดสอบ", evidenceIds: ["two"] }
      ) } }] });
    const knowledge = new KnowledgeService({ hasIndexedEvidence: async () => true, hybridSearch: async () => evidence }, fakeEmbed);
    const { createConciseChatFixture } = await import("@/evals/concise-chat/fixtures");
    const fixture = await createConciseChatFixture({ knowledgeService: knowledge, history });
    const reply = await fixture.service.createBotReply({ channel, lineUserId: "synthetic-eval-user", message: "แล้ว iPhone ล่ะ" });
    assert.deepEqual(reply.sources, [{ title: reviewed.title, url: evidence[1].sourceUrl }]);
    assert.ok(reply.text.includes(evidence[1].sourceUrl));
    assert.equal(reply.usedWebSearch, undefined);
    assert.ok(reply.executionLog?.some((entry) => entry.action === "Reranker" && entry.status === "applied"));
    assert.ok(reply.executionLog?.some((entry) => entry.action === "Query Rewrite" && entry.status === "applied"));
    assert.equal(reply.executionLog?.at(-1)?.action, "Output");
    assert.equal(fixture.messages[0].content, "แล้ว iPhone ล่ะ");
    assert.deepEqual((fixture.updates.at(-1)?.metadata as { sourceUrls: string[] }).sourceUrls, [evidence[1].sourceUrl]);
    assert.deepEqual((fixture.updates.at(-1)?.metadata as { executionLog: unknown }).executionLog, reply.executionLog);
  });
}

test("scheduled checker denies missing/wrong secrets and reports attention without approving data", async () => {
  const { KnowledgeCheckController } = await import("@/src/controllers/knowledge-check.controller");
  let calls = 0;
  const controller = new KnowledgeCheckController({ checkSources: async () => {
    calls++; return [{ id: "one", status: "CHANGED", reviewOverdue: true }];
  } });
  const url = "https://fixture.test/api/knowledge/check";
  assert.equal((await controller.check(new Request(url))).status, 401);
  env.CRON_SECRET = "x".repeat(32);
  assert.equal((await controller.check(new Request(url, { headers: { authorization: "Bearer invalid" } }))).status, 401);
  assert.equal(calls, 0);
  const result = await controller.check(new Request(url, { headers: { authorization: `Bearer ${env.CRON_SECRET}` } }));
  assert.equal(result.status, 200);
  assert.equal((await result.json()).attentionRequired, true);
  assert.equal(calls, 1);
});

test("empty approved corpus skips embedding and answer provider calls", async () => {
  const service = new KnowledgeService({ hasIndexedEvidence: async () => false,
    hybridSearch: async () => { throw new Error("Must not search"); } },
  async () => { throw new Error("Must not call embedding provider"); },
  async () => { throw new Error("Must not call answer provider"); },
  async () => { throw new Error("Must not call rerank provider"); },
  async () => { throw new Error("Must not call rewrite provider"); });
  assert.equal((await service.answerQuestion("ขอเอกสาร", [{ role: "user", content: "Wi-Fi" }])).isMiss, true);
});
