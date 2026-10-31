import assert from "node:assert/strict";
import { afterEach, before, test } from "node:test";
import type { KnowledgeEvidence } from "@/src/repositories/knowledge.repository";
import { KnowledgeDocumentSchema, KnowledgeManifestSchema, knowledgeActionLinkSchema } from "@/src/dtos/knowledge.dto";

let KnowledgeIngestionService: typeof import("@/src/services/knowledge-ingestion.service").KnowledgeIngestionService;
let KnowledgeService: typeof import("@/src/services/knowledge.service").KnowledgeService;
let rewrite: typeof import("@/lib/ai").rewriteKnowledgeAnswer;
let buildFaqManifest: typeof import("@/src/lib/rag/knowledge-faq").buildFaqManifest;
let appendActionLinks: typeof import("@/src/presenters/knowledge-answer.presenter").appendActionLinks;
let env: typeof import("@/src/config/env").env;
const originalFetch = globalThis.fetch;
const now = new Date("2026-10-13T00:00:00Z");
const vector = [1, ...Array<number>(1535).fill(0)];
const fakeEmbed = async () => ({ vectors: [vector], usage: { total_tokens: 1 }, model: "text-embedding-3-small" as const });

before(async () => {
  process.env.DATABASE_URL ??= "postgresql://fixture:fixture@localhost:5432/fixture_unused";
  ({ env } = await import("@/src/config/env"));
  env.OPENAI_API_KEY = "synthetic-key";
  ({ KnowledgeIngestionService } = await import("@/src/services/knowledge-ingestion.service"));
  ({ KnowledgeService } = await import("@/src/services/knowledge.service"));
  ({ rewriteKnowledgeAnswer: rewrite } = await import("@/lib/ai"));
  ({ buildFaqManifest } = await import("@/src/lib/rag/knowledge-faq"));
  ({ appendActionLinks } = await import("@/src/presenters/knowledge-answer.presenter"));
});
afterEach(() => { globalThis.fetch = originalFetch; });

const reviewed = {
  title: "Synthetic Registrar", category: "Synthetic test", content: "ขอเอกสารผ่านระบบทดสอบ",
  keywords: ["เอกสาร", "IT232"], sourceUrl: "https://bu.ac.th/synthetic-test",
  sourceHash: "a".repeat(64), verifiedBy: "Synthetic fixture only",
  verifiedAt: "2026-10-12T00:00:00Z", reviewAfter: "2099-01-01T00:00:00Z"
};
const link = (url: string, label = "ลิงก์ทดสอบ") => knowledgeActionLinkSchema.safeParse({ label, url });

test("action links accept bu.ac.th, subdomains and the allowed external hosts", () => {
  for (const url of [
    "https://bulinks.bu.ac.th/service-petition-new/", "https://bu.ac.th/",
    "https://th-th.facebook.com/scholarship.bu/", "https://login.microsoftonline.com/",
    "https://line.me/R/ti/p/@bu1stop", "https://www.youtube.com/watch?v=OvpeHb3wthc"
  ]) assert.equal(link(url).success, true, url);
});

test("action links reject hostile URLs, empty labels and overlong labels", () => {
  for (const url of [
    "http://bu.ac.th/", "javascript:alert(1)", "https://user:pw@bu.ac.th/",
    "https://bu.ac.th.evil.com/", "https://evilfacebook.com/", "https://evilline.me/", "https://youtube.com.evil.test/", "https://bu.ac.th:8443/",
    "https://bu.ac.th/#frag"
  ]) assert.equal(link(url).success, false, url);
  assert.equal(link("https://bu.ac.th/", "").success, false);
  assert.equal(link("https://bu.ac.th/", "x".repeat(101)).success, false);
});

test("document defaults to PAGE with no action links; more than 5 links rejected", () => {
  const parsed = KnowledgeDocumentSchema.parse(reviewed);
  assert.equal(parsed.sourceKind, "PAGE");
  assert.deepEqual(parsed.actionLinks, []);
  const links = Array.from({ length: 6 }, (_, index) => ({ label: `l${index}`, url: `https://bu.ac.th/${index}` }));
  assert.equal(KnowledgeDocumentSchema.safeParse({ ...reviewed, actionLinks: links }).success, false);
  assert.equal(KnowledgeDocumentSchema.safeParse({ ...reviewed, actionLinks: links.slice(0, 5) }).success, true);
});

test("manifest accepts 195 unique documents and rejects 301", () => {
  const many = (count: number) => Array.from({ length: count }, (_, index) => ({ ...reviewed, title: `t${index}` }));
  assert.equal(KnowledgeManifestSchema.safeParse(many(195)).success, true);
  assert.equal(KnowledgeManifestSchema.safeParse(many(301)).success, false);
});

function ingestion(fetchSource: () => Promise<{ sourceHash: string; finalUrl: string }>) {
  const saved: unknown[] = [];
  const repo = {
    findIndexedDocument: async () => null,
    saveReviewedDocument: async (item: unknown) => { saved.push(item); return "one"; },
    listSourcesForCheck: async () => [], recordSourceCheck: async () => ({ count: 0 }),
    listOverdueFileDocuments: async () => []
  };
  return { saved, service: new KnowledgeIngestionService(repo, fakeEmbed, fetchSource) };
}

test("FILE import never fetches the source", async () => {
  const { service, saved } = ingestion(async () => { throw new Error("network must not be used"); });
  const [result] = await service.importManifest([{ ...reviewed, sourceKind: "FILE" }], now);
  assert.equal(result.embedded, true);
  assert.equal(saved.length, 1);
});

test("PAGE import still fails when the source hash differs", async () => {
  const { service, saved } = ingestion(async () => ({ sourceHash: "b".repeat(64), finalUrl: reviewed.sourceUrl }));
  await assert.rejects(() => service.importManifest([reviewed], now), /Source changed/);
  assert.equal(saved.length, 0);
});

const linkA = { label: "ลิงก์ A", url: "https://bulinks.bu.ac.th/a/" };
const linkB = { label: "ยื่นคำร้องออนไลน์", url: "https://bulinks.bu.ac.th/service-petition-new/" };
const evidenceWith = (links: Array<typeof linkA[]>): KnowledgeEvidence[] => links.map((actionLinks, index) => ({
  id: `e${index}`, documentId: `e${index}`, title: `FAQ ${index}`, category: "FAQ", content: "ขั้นตอนทดสอบ",
  keywords: [], source: "https://faq.bu.ac.th/wordpress/", sourceUrl: "https://faq.bu.ac.th/wordpress/",
  created_at: now.toISOString(), updated_at: now.toISOString(), verifiedAt: now,
  validFrom: null, validUntil: null, score: 0.02, similarity: 0.8, keywordRank: 1, vectorRank: 1, actionLinks
}));
const answering = (answer: string, evidenceIds: string[], bodies: string[] = []) => {
  globalThis.fetch = async (_url, init) => {
    bodies.push(String(init?.body));
    return Response.json({ choices: [{ message: { content: JSON.stringify({ answer, evidenceIds }) } }], usage: { total_tokens: 1 }, model: "synthetic" });
  };
};

test("answer returns links only for cited evidence, de-duplicated", async () => {
  answering("คำตอบทดสอบ", ["e1"]);
  const result = await rewrite({ evidence: evidenceWith([[linkA], [linkB, linkB]]), question: "ขอ transcript" });
  assert.deepEqual(result.actionLinks, [linkB]);
});

test("no links when cited evidence has none, and none on a miss", async () => {
  answering("คำตอบทดสอบ", ["e0"]);
  assert.deepEqual((await rewrite({ evidence: evidenceWith([[], [linkB]]), question: "q" })).actionLinks ?? [], []);
  answering("คำตอบ", ["invented"]);
  const miss = await rewrite({ evidence: evidenceWith([[linkA]]), question: "q" });
  assert.equal(miss.text, "NO_VERIFIED_INFO_FOUND");
  assert.deepEqual(miss.actionLinks ?? [], []);
});

test("evidence payload sent to the model lists link labels but no link URLs", async () => {
  const bodies: string[] = [];
  answering("คำตอบทดสอบ", ["e0"], bodies);
  await rewrite({ evidence: evidenceWith([[linkB]]), question: "q" });
  assert.ok(bodies[0].includes(linkB.label));
  assert.ok(!bodies[0].includes(linkB.url));
});

test("appendActionLinks leaves text alone without links and lists label: url lines", () => {
  assert.equal(appendActionLinks("คำตอบ", []), "คำตอบ");
  assert.equal(appendActionLinks("คำตอบ", [linkA, linkB]),
    `คำตอบ

ลิงก์สำหรับทำรายการ:
- ${linkA.label}: ${linkA.url}
- ${linkB.label}: ${linkB.url}`);
});

test("knowledge answer text carries the link block; a miss carries none", async () => {
  const evidence = evidenceWith([[linkB]]);
  const repo = { hasIndexedEvidence: async () => true, hybridSearch: async () => evidence };
  const hit = await new KnowledgeService(repo, fakeEmbed, async () => ({ text: "คำตอบ", sources: [], actionLinks: [linkB],
    usage: { total_tokens: 1 }, model: "synthetic" })).answerQuestion("ขอ transcript");
  assert.ok(hit.text.endsWith(`ลิงก์สำหรับทำรายการ:
- ${linkB.label}: ${linkB.url}`));
  const miss = await new KnowledgeService(repo, fakeEmbed, async () => ({ text: "NO_VERIFIED_INFO_FOUND", sources: [],
    usage: undefined, model: undefined })).answerQuestion("ขอ transcript");
  assert.equal(miss.isMiss, true);
  assert.ok(!miss.text.includes("ลิงก์สำหรับทำรายการ"));
});

const faqFile = { name: "FAQ x Website links.pdf", sha256: "c".repeat(64) };
const faqEntry = { title: "ขอ Transcript อย่างไร", category: "ทะเบียน", content: "ยื่นคำร้องออนไลน์ แล้วรับเอกสารที่ A8 ชั้น 2",
  keywords: ["transcript"], actionLinks: [linkB] };

test("builder fills FILE metadata and a 6-month review date", () => {
  const [item] = buildFaqManifest([faqEntry], faqFile, new Date("2026-10-23T03:00:00Z"));
  assert.equal(item.sourceKind, "FILE");
  assert.equal(item.sourceUrl, "https://faq.bu.ac.th/wordpress/");
  assert.equal(item.sourceHash, faqFile.sha256);
  assert.equal(item.verifiedBy, "BU FAQ file: FAQ x Website links.pdf");
  assert.equal(new Date(item.verifiedAt).toISOString(), "2026-10-23T03:00:00.000Z");
  assert.equal(new Date(item.reviewAfter).toISOString(), "2027-04-23T03:00:00.000Z");
  assert.deepEqual(item.actionLinks, [linkB]);
});

test("builder throws on duplicate titles, naming the title", () => {
  assert.throws(() => buildFaqManifest([faqEntry, { ...faqEntry }], faqFile, now), /ขอ Transcript อย่างไร/);
});

test("builder throws when content contains a URL", () => {
  for (const content of ["ไปที่ http://bu.ac.th", "ไปที่ https://bu.ac.th", "ไปที่ www.bu.ac.th"]) {
    assert.throws(() => buildFaqManifest([{ ...faqEntry, content }], faqFile, now), /ขอ Transcript อย่างไร/);
  }
});

test("builder output round-trips through KnowledgeManifestSchema", () => {
  const manifest = buildFaqManifest([faqEntry, { ...faqEntry, title: "อีกข้อ", actionLinks: [] }], faqFile, now);
  assert.equal(KnowledgeManifestSchema.parse(JSON.parse(JSON.stringify(manifest))).length, 2);
});

test("action links reject whitespace smuggling, URLs inside labels and malformed URLs without throwing", () => {
  for (const url of ["https://bu.ac.th/ https://evil.example/", "https://bu.ac.th/\nhttps://evil.example/",
    "https://bu.ac.th/\thttps://evil.example/", "https://bu.ac.th/ x", "not a url"]) assert.equal(link(url).success, false, JSON.stringify(url));
  for (const label of ["คลิก https://evil.example/ ที่นี่", "คลิก www.evil.example", "a\nb"]) {
    assert.equal(link("https://bu.ac.th/", label).success, false, JSON.stringify(label));
  }
});

test("scheduled check reports overdue FILE documents without fetching, and a single-document check does not", async () => {
  const noFetch = async () => { throw new Error("network must not be used"); };
  const repo = (calls: string[]) => ({
    findIndexedDocument: async () => null, saveReviewedDocument: async () => "one",
    listSourcesForCheck: async () => [], recordSourceCheck: async () => ({ count: 0 }),
    listOverdueFileDocuments: async () => { calls.push("overdue"); return [{ id: "file-1" }]; }
  });
  const calls: string[] = [];
  const service = new KnowledgeIngestionService(repo(calls), fakeEmbed, noFetch);
  assert.deepEqual(await service.checkSources(), [{ id: "file-1", status: "UNCHANGED", reviewOverdue: true }]);
  assert.deepEqual(await service.checkSources("only-this"), []);
  assert.deepEqual(calls, ["overdue"]);
});

test("import refuses a title that already belongs to a different source kind, before saving anything", async () => {
  const saved: unknown[] = [];
  const repo = {
    findIndexedDocument: async (title: string) => title === "Collides" ? ({ title, sourceKind: "PAGE", contentHash: "x", chunks: [] }) : null,
    saveReviewedDocument: async (item: unknown) => { saved.push(item); return "one"; },
    listSourcesForCheck: async () => [], recordSourceCheck: async () => ({ count: 0 }), listOverdueFileDocuments: async () => []
  } as unknown as ConstructorParameters<typeof KnowledgeIngestionService>[0];
  const service = new KnowledgeIngestionService(repo, fakeEmbed, async () => { throw new Error("network must not be used"); });
  await assert.rejects(() => service.importManifest([
    { ...reviewed, title: "Fresh", sourceKind: "FILE" }, { ...reviewed, title: "Collides", sourceKind: "FILE" }
  ], now), /Collides/);
  assert.equal(saved.length, 0);
});

test("builder trims titles before the duplicate check and names the title", () => {
  assert.throws(() => buildFaqManifest([faqEntry, { ...faqEntry, title: `${faqEntry.title} ` }], faqFile, now), /ขอ Transcript อย่างไร/);
});

test("a manifest of exactly 300 documents is accepted", () => {
  const many = Array.from({ length: 300 }, (_, index) => ({ ...reviewed, title: `t${index}` }));
  assert.equal(KnowledgeManifestSchema.safeParse(many).success, true);
});

test("answer links are de-duplicated across cited items and capped at five", async () => {
  const links = Array.from({ length: 4 }, (_, index) => ({ label: `ลิงก์ ${index}`, url: `https://bu.ac.th/${index}` }));
  answering("คำตอบทดสอบ", ["e0", "e1"]);
  const result = await rewrite({ evidence: evidenceWith([links.slice(0, 3), [links[1], links[2], ...links.slice(3), { label: "ลิงก์ 4", url: "https://bu.ac.th/4" }, { label: "ลิงก์ 5", url: "https://bu.ac.th/5" }]]), question: "q" });
  assert.deepEqual(result.actionLinks?.map((link) => link.url), [0, 1, 2, 3, 4].map((index) => `https://bu.ac.th/${index}`));
});

test("knowledge answer request omits temperature, which the default model rejects with HTTP 400", async () => {
  const bodies: string[] = [];
  answering("คำตอบทดสอบ", ["e0"], bodies);
  await rewrite({ evidence: evidenceWith([[]]), question: "q" });
  assert.equal("temperature" in JSON.parse(bodies[0]), false);
});
