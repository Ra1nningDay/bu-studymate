import assert from "node:assert/strict";
import { before, test } from "node:test";
import { KnowledgeSaveSchema } from "@/src/dtos/knowledge-admin.dto";
import { knowledgeContentHash } from "@/lib/knowledge-index";
import type { KnowledgeRepository } from "@/src/repositories/knowledge.repository";
import type { KnowledgeIngestionService } from "./knowledge-ingestion.service";

let Service: typeof import("./knowledge-admin.service").KnowledgeAdminService;
let ErrorClass: typeof import("./knowledge-admin.service").KnowledgeAdminError;
let availability: typeof import("./knowledge-admin.service").knowledgeAvailability;
let Controller: typeof import("@/src/controllers/knowledge-admin.controller").KnowledgeAdminController;
let Repository: typeof import("@/src/repositories/knowledge.repository").KnowledgeRepository;
let Auth: typeof import("./admin-auth.service").AdminAuthService;

const id = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const now = new Date("2026-10-13T00:00:00Z");
const raw = { title: "Synthetic Wi-Fi", category: "Synthetic only", content: "ข้อมูลทดสอบ ไวไฟ",
  keywords: ["wifi"], sourceUrl: "https://bu.ac.th/synthetic", sourceHash: "a".repeat(64),
  verifiedBy: "Synthetic reviewer", verifiedAt: "2026-10-12T00:00:00Z", reviewAfter: "2099-01-01T00:00:00Z" };
const document = KnowledgeSaveSchema.parse({ document: raw }).document;
const item = { ...document, id, source: raw.sourceUrl, contentHash: knowledgeContentHash(document),
  sourceStatus: "UNCHANGED", createdAt: now, updatedAt: now, sourceCheckedAt: now,
  validFrom: null, validUntil: null,
  chunks: [{ documentHash: knowledgeContentHash(document), embeddingModel: "text-embedding-3-small" }] };

before(async () => {
  process.env.DATABASE_URL ??= "postgresql://fixture:fixture@localhost:5432/fixture_unused";
  ({ KnowledgeAdminService: Service, KnowledgeAdminError: ErrorClass, knowledgeAvailability: availability } = await import("./knowledge-admin.service"));
  ({ KnowledgeAdminController: Controller } = await import("@/src/controllers/knowledge-admin.controller"));
  ({ KnowledgeRepository: Repository } = await import("@/src/repositories/knowledge.repository"));
  ({ AdminAuthService: Auth } = await import("./admin-auth.service"));
});

function fixture(existing = false) {
  const calls: unknown[] = [];
  const repo = {
    listAdminDocuments: async (search: string, page: number, limit: number) => { calls.push({ search, page, limit }); return { items: [item], total: 25, stats: { total: 25, ready: 1, unapproved: 24, review: 0 }, categories: [item.category] }; },
    readAdminDocument: async () => ({ id, chunks: [{ id: "chunk-one", ordinal: 0, content: raw.content, embeddingModel: "text-embedding-3-small" }] }),
    findById: async () => existing ? item : null,
    findIndexedDocument: async () => existing ? item : null,
    findBulkDocuments: async () => existing ? [{ ...item, chunks: [{ ...item.chunks[0], id: otherId, ordinal: 0, content: raw.content }] }] : [],
    deleteAdminDocuments: async (selection) => { calls.push({ delete: selection }); return selection.length; },
    updateAdminMetadata: async (selection, updates) => { calls.push({ selection, updates }); return updates.length; }
  } as Pick<KnowledgeRepository, "listAdminDocuments" | "readAdminDocument" | "findById" | "findIndexedDocument" | "findBulkDocuments" | "deleteAdminDocuments" | "updateAdminMetadata">;
  const ingestion = {
    importReviewedDocument: async (value: unknown, expectedId?: string | null) => { calls.push({ value, expectedId }); return { id, chunks: 1, embedded: true }; },
    checkSources: async (value?: string) => { calls.push(value); return [{ id, status: "UNCHANGED", reviewOverdue: false }]; }
  } satisfies Pick<KnowledgeIngestionService, "importReviewedDocument" | "checkSources">;
  const embedded: string[][] = [];
  const service = new Service(repo, ingestion, async (sourceUrl) => {
    calls.push(sourceUrl); return { sourceHash: raw.sourceHash, finalUrl: sourceUrl };
  }, async (input) => { embedded.push(input); return { vectors: input.map(() => [1, ...Array<number>(1535).fill(0)]), usage: { total_tokens: 1 }, model: "text-embedding-3-small" }; });
  const auth = new Auth("fixture-password");
  const headers = { origin: "http://localhost:3033", cookie: `studymate-admin=${auth.createSession("fixture-password")}` };
  const controller = new Controller(service, auth);
  const request = (body: unknown = {}, overrides: Record<string, string> = {}) => new Request("http://localhost:3033/api/admin/knowledge", {
    method: "POST", headers: { ...headers, ...overrides }, body: JSON.stringify(body)
  });
  return { repo, ingestion, service, controller, calls, embedded, headers, request };
}

test("all knowledge endpoints deny unauthenticated callers before repository/source work", async () => {
  const f = fixture();
  const request = () => new Request("http://localhost:3033/api/admin/knowledge?password=fixture-password", { method: "POST", body: "invalid" });
  assert.equal((await f.controller.list(request())).status, 401);
  assert.equal((await f.controller.read(request(), id)).status, 401);
  assert.equal((await f.controller.save(request())).status, 401);
  assert.equal((await f.controller.snapshot(request())).status, 401);
  assert.equal((await f.controller.check(request(), id)).status, 401);
  assert.equal((await f.controller.bulk(request())).status, 401);
  assert.deepEqual(f.calls, []);
});

test("save, snapshot and source checks reject cross-origin or missing-origin writes", async () => {
  const f = fixture();
  for (const origin of ["https://attacker.test", ""]) {
    assert.equal((await f.controller.save(f.request({}, { origin }))).status, 403);
    assert.equal((await f.controller.snapshot(f.request({}, { origin }))).status, 403);
    assert.equal((await f.controller.check(f.request({}, { origin }), id)).status, 403);
    assert.equal((await f.controller.bulk(f.request({}, { origin }))).status, 403);
  }
  assert.deepEqual(f.calls, []);
});

test("strict document, official source, UUID, date and pagination validation precedes work", async () => {
  const f = fixture();
  for (const body of [{}, { document: { ...raw, verifiedBy: "" } }, { document: { ...raw, reviewAfter: raw.verifiedAt } },
    { id: "bad", document: raw }, { document: { ...raw, sourceUrl: "https://attacker.test" } }, { document: raw, unexpected: true }]) {
    assert.equal((await f.controller.save(f.request(body))).status, 400);
  }
  assert.equal((await f.controller.snapshot(f.request({ sourceUrl: "https://bu.ac.th.attacker.test" }))).status, 400);
  assert.equal((await f.controller.check(f.request(), "invalid")).status, 400);
  for (const page of ["0", "NaN", "1.5", "100001"]) {
    assert.equal((await f.controller.list(new Request(`http://localhost:3033/api/admin/knowledge?page=${page}`, { headers: f.headers }))).status, 400);
  }
  for (const query of ["status=unknown", "source=upload", "limit=1000", "category=" + "a".repeat(101)]) {
    assert.equal((await f.controller.list(new Request(`http://localhost:3033/api/admin/knowledge?${query}`, { headers: f.headers }))).status, 400);
  }
  assert.deepEqual(f.calls, []);
});

test("malformed JSON produces a validation response without work", async () => {
  const f = fixture();
  const request = () => new Request("http://localhost:3033/api/admin/knowledge", { method: "POST", headers: f.headers, body: "{" });
  assert.equal((await f.controller.save(request())).status, 400);
  assert.equal((await f.controller.snapshot(request())).status, 400);
  assert.deepEqual(f.calls, []);
});

test("search/pagination return private serializable documents and accurate eligibility", async () => {
  const f = fixture();
  const response = await f.controller.list(new Request("http://localhost:3033/api/admin/knowledge?search=wifi&page=2", { headers: f.headers }));
  const data = await response.json();
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(data.total, 25);
  assert.equal(data.items[0].chunkCount, 1);
  assert.equal(data.items[0].availability, "พร้อมใช้ใน RAG");
  assert.equal(data.items[0].verifiedAt, raw.verifiedAt.replace("Z", ".000Z"));
  assert.equal(data.items[0].chunks, undefined);
  assert.deepEqual(f.calls, [{ search: "wifi", page: 2, limit: 10 }]);
});

test("eligibility explains unapproved, stale, invalid, expired and incompatible evidence", () => {
  assert.equal(availability(item, now), "พร้อมใช้ใน RAG");
  for (const [change, reason] of [
    [{ verifiedBy: null }, "ยังไม่ผ่านการตรวจทาน"], [{ sourceUrl: "https://attacker.test" }, "แหล่งอ้างอิงไม่ใช่เว็บไซต์ BU ที่รองรับ"],
    [{ verifiedAt: new Date("2099-01-01") }, "วันตรวจทานอยู่ในอนาคต"], [{ reviewAfter: now }, "ถึงกำหนดตรวจทานใหม่"],
    [{ validFrom: new Date("2099-01-01") }, "ยังไม่ถึงช่วงใช้งาน"], [{ validUntil: now }, "หมดอายุ"],
    [{ sourceStatus: "CHANGED" }, "แหล่งข้อมูลเปลี่ยนแปลง"], [{ sourceStatus: "UNAVAILABLE" }, "ยังยืนยันแหล่งข้อมูลไม่ได้"],
    [{ content: "Edited outside ingestion" }, "เนื้อหาไม่ตรงกับดัชนี"], [{ chunks: [] }, "ยังไม่มีดัชนีที่ใช้ได้"],
    [{ chunks: [{ documentHash: item.contentHash, embeddingModel: "old" }] }, "ยังไม่มีดัชนีที่ใช้ได้"]
  ] as const) assert.equal(availability({ ...item, ...change } as typeof item, now), reason);
});

test("create/edit pass explicit identity to shared ingestion and source checks target one record", async () => {
  const created = fixture();
  assert.equal((await created.controller.save(created.request({ document: raw }))).status, 200);
  assert.deepEqual(created.calls, [{ value: document, expectedId: null }]);
  const edit = fixture(true);
  assert.equal((await edit.controller.save(edit.request({ id, document: raw }))).status, 200);
  assert.deepEqual(edit.calls, [{ value: document, expectedId: id }]);
  assert.equal((await edit.controller.check(edit.request(), id)).status, 200);
  assert.equal(edit.calls.at(-1), id);
  assert.equal((await edit.controller.snapshot(edit.request({ sourceUrl: raw.sourceUrl }))).status, 200);
  assert.equal(edit.calls.at(-1), raw.sourceUrl);
});

test("duplicate title, renamed edit and missing identity cannot invoke ingestion", async () => {
  const f = fixture(true);
  assert.equal((await f.controller.save(f.request({ document: raw }))).status, 409);
  assert.equal((await f.controller.save(f.request({ id, document: { ...raw, title: "Renamed" } }))).status, 409);
  assert.equal((await fixture().controller.save(f.request({ id, document: raw }))).status, 404);
  assert.deepEqual(f.calls, []);
});

test("known ingestion conflicts are actionable; provider/database details remain private", async () => {
  const f = fixture();
  for (const [message, status] of [
    ["Source changed since review: topic", 409], ["Document identity changed; refresh before saving", 409],
    ["An older approval cannot replace a newer document", 409], ["Changed content needs a newer approval", 409],
    ["Cannot import future approvals or overdue reviews", 400], ["secret connection details", 503]
  ] as const) {
    f.ingestion.importReviewedDocument = async () => { throw new Error(message); };
    const response = await f.controller.save(f.request({ document: raw }));
    assert.equal(response.status, status);
    assert.ok(!(await response.text()).includes("secret connection details"));
  }
});

test("repository rejects a create collision, renamed/missing edit and concurrent identity swap inside the transaction", async () => {
  let writes = 0;
  const db = { knowledgeItem: { findUnique: async () => ({ ...item, id: otherId }), upsert: async () => { writes++; return { id }; } },
    $transaction: async (save: (tx: unknown) => unknown) => save(db) };
  const repo = new Repository(db as unknown as ConstructorParameters<typeof Repository>[0]);
  for (const expectedId of [null, id]) {
    await assert.rejects(() => repo.saveReviewedDocument(document, null, expectedId), /identity changed/);
  }
  db.knowledgeItem.findUnique = async () => null as unknown as typeof item;
  await assert.rejects(() => repo.saveReviewedDocument(document, null, id), /identity changed/);
  assert.equal(writes, 0);
});

test("single source check does not renew approval and refuses legacy records without provenance", async () => {
  const f = fixture(true);
  f.repo.findById = async () => ({ ...item, sourceHash: null });
  await assert.rejects(() => f.service.check(id), (error: unknown) => error instanceof ErrorClass && error.status === 400);
  assert.deepEqual(f.calls, []);
});

test("source checks report a conflict if the selected record disappears during the check", async () => {
  const f = fixture(true);
  f.ingestion.checkSources = async () => [];
  await assert.rejects(() => f.service.check(id), (error: unknown) => error instanceof ErrorClass && error.status === 409);
});

test("indexed passage reads are authenticated, UUID-bound and return real content without vectors", async () => {
  const f = fixture(true);
  assert.equal((await f.controller.read(f.request(), "bad")).status, 400);
  const response = await f.controller.read(f.request(), id);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal((await response.json()).chunks[0].content, raw.content);
  f.repo.readAdminDocument = async () => null;
  assert.equal((await f.controller.read(f.request(), id)).status, 404);
});

test("filters reach storage before pagination, and totals remain corpus-wide", async () => {
  const f = fixture();
  let received: unknown;
  const list = f.repo.listAdminDocuments;
  f.repo.listAdminDocuments = async (...args) => { received = args; return list(...args); };
  const response = await f.controller.list(new Request("http://localhost:3033/api/admin/knowledge?category=Testing&status=review&source=official&limit=20&page=2", { headers: f.headers }));
  assert.equal(response.status, 200);
  assert.deepEqual(received, ["", 2, 20, { search: "", page: 2, category: "Testing", status: "review", source: "official", limit: 20 }]);
  assert.equal((await response.json()).stats.total, 25);
});

test("a shrinking filtered result moves an out-of-range page to the last available page", async () => {
  const f = fixture();
  const data = await f.service.list("", 8);
  assert.equal(data.page, 3);
  assert.deepEqual(f.calls, [{ search: "", page: 8, limit: 10 }, { search: "", page: 3, limit: 10 }]);
});

const selection = [{ id, updatedAt: now.toISOString() }];

test("bulk validation rejects ambiguous, oversized, duplicate and unsupported edits before any work", async () => {
  const f = fixture(true);
  for (const body of [
    { action: "delete", selection: [] }, { action: "delete", selection: [selection[0], selection[0]] },
    { action: "delete", selection: Array.from({ length: 51 }, () => selection[0]) },
    { action: "delete", selection: [{ id }] }, { action: "delete", selection: [{ id, updatedAt: "bad" }] },
    { action: "delete", selection: [{ ...selection[0], id: "all" }] },
    { action: "update", selection, changes: {} }, { action: "update", selection, changes: { category: " " } },
    { action: "update", selection, changes: { content: "overwrite" } },
    { action: "update", selection, changes: { verifiedAt: now.toISOString() } },
    { action: "update", selection, changes: { keywords: ["a".repeat(51)] } }
  ]) assert.equal((await f.controller.bulk(f.request(body))).status, 400);
  assert.deepEqual(f.calls, []);
  assert.deepEqual(f.embedded, []);
});

test("bulk delete submits only explicit versioned identities under shared auth", async () => {
  const f = fixture(true);
  const response = await f.controller.bulk(f.request({ action: "delete", selection }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await response.json(), { count: 1 });
  assert.deepEqual(f.calls, [{ delete: selection }]);
  assert.deepEqual(f.embedded, []);
});

test("keyword metadata edits preserve vectors and approval fields while refreshing lexical fingerprints", async () => {
  const f = fixture(true);
  await f.service.bulk({ action: "update", selection, changes: { keywords: ["ทุนพิเศษ"] } });
  const result = f.calls[0] as { updates: Array<{ category: string; keywords: string[]; contentHash: string; chunks: Array<{ searchText: string; embedding?: number[] }> }> };
  assert.equal(result.updates[0].category, document.category);
  assert.deepEqual(result.updates[0].keywords, ["ทุนพิเศษ"]);
  assert.equal(result.updates[0].contentHash, knowledgeContentHash({ ...document, keywords: ["ทุนพิเศษ"] }));
  assert.ok(result.updates[0].chunks[0].searchText.includes("ทุน"));
  assert.equal(result.updates[0].chunks[0].embedding, undefined);
  for (const field of ["content", "verifiedAt", "reviewAfter", "sourceStatus", "sourceHash"]) assert.ok(!(field in result.updates[0]));
  assert.deepEqual(f.embedded, []);
});

test("category edits prepare existing passages before the atomic update", async () => {
  const f = fixture(true);
  await f.service.bulk({ action: "update", selection, changes: { category: "New category", keywords: [] } });
  assert.deepEqual(f.embedded, [[`${raw.title}\nNew category\n${raw.content}`]]);
  const result = f.calls[0] as { updates: Array<{ chunks: Array<{ embedding: number[] }> }> };
  assert.equal(result.updates[0].chunks[0].embedding.length, 1536);
});

test("legacy and stale evidence cannot regain a valid fingerprint through bulk metadata changes", async () => {
  const f = fixture(true);
  const original = (await f.repo.findBulkDocuments([id]))[0];
  for (const change of [{ sourceUrl: null }, { contentHash: "stale" },
    { content: "unreviewed text" }, { chunks: [] },
    { chunks: [{ ...original.chunks[0], embeddingModel: "wrong-model" }] }]) {
    f.calls.length = 0;
    f.repo.findBulkDocuments = async () => [{ ...original, ...change }];
    await f.service.bulk({ action: "update", selection, changes: { category: "Changed" } });
    const result = f.calls[0] as { updates: Array<{ contentHash: string | null; chunks: unknown[] }> };
    assert.equal(result.updates[0].contentHash, null);
    assert.deepEqual(result.updates[0].chunks, []);
  }
  assert.deepEqual(f.embedded, []);
});

test("stale or missing selections fail before embedding, without updates", async () => {
  for (const records of [[], [{ ...item, updatedAt: new Date(now.getTime() + 1000), chunks: [] }]]) {
    const f = fixture(true);
    f.repo.findBulkDocuments = async () => records;
    const response = await f.controller.bulk(f.request({ action: "update", selection, changes: { category: "New" } }));
    assert.equal(response.status, 409);
    assert.deepEqual(f.calls, []);
    assert.deepEqual(f.embedded, []);
  }
});

test("provider failure or incomplete embedding preparation cannot start a metadata transaction", async () => {
  const f = fixture(true);
  for (const embed of [async () => { throw new Error("provider down"); }, async () => ({ vectors: [], usage: { total_tokens: 0 }, model: "text-embedding-3-small" as const })]) {
    const service = new Service(f.repo, f.ingestion, undefined, embed);
    await assert.rejects(() => service.bulk({ action: "update", selection, changes: { category: "New" } }));
    assert.deepEqual(f.calls, []);
  }
});

test("unchanged bulk metadata performs no provider call or document update", async () => {
  const f = fixture(true);
  assert.deepEqual(await f.service.bulk({ action: "update", selection, changes: { category: raw.category } }), { count: 0 });
  assert.deepEqual(f.calls, [{ selection, updates: [] }]);
  assert.deepEqual(f.embedded, []);
});

test("bulk category preparation respects the adapter's 32-passage batch limit", async () => {
  const f = fixture(true);
  const original = (await f.repo.findBulkDocuments([id]))[0];
  const records = Array.from({ length: 33 }, (_, index) => {
    const record = { ...original, id: `${String(index + 1).padStart(8, "0")}-1111-4111-8111-111111111111`, title: `Synthetic ${index}` };
    const contentHash = knowledgeContentHash({ ...record, sourceUrl: record.sourceUrl! });
    return { ...record, contentHash, chunks: [{ ...record.chunks[0], documentHash: contentHash }] };
  });
  f.repo.findBulkDocuments = async () => records;
  await f.service.bulk({ action: "update", selection: records.map(({ id: recordId }) => ({ id: recordId, updatedAt: now.toISOString() })), changes: { category: "Changed" } });
  assert.deepEqual(f.embedded.map((batch) => batch.length), [32, 1]);
  assert.equal((f.calls[0] as { updates: unknown[] }).updates.length, 33);
});

test("a transaction conflict after embedding preparation remains an actionable failure", async () => {
  const f = fixture(true);
  f.repo.updateAdminMetadata = async () => { throw new Error("Selected documents changed; refresh before saving"); };
  const response = await f.controller.bulk(f.request({ action: "update", selection, changes: { category: "New" } }));
  assert.equal(response.status, 409);
  assert.deepEqual(f.calls, []);
  assert.equal(f.embedded.length, 1);
});

test("admin refuses to create, edit or check FILE-sourced documents through the page flow", async () => {
  const f = fixture(true);
  const fileItem = { ...item, sourceKind: "FILE" };
  const service = new Service({ ...f.repo, findById: async () => fileItem } as typeof f.repo, f.ingestion);
  const status = async (run: () => Promise<unknown>) => {
    try { await run(); } catch (error) { return error instanceof ErrorClass ? error.status : -1; }
    return 0;
  };
  assert.equal(await status(() => service.save({ document: { ...document, sourceKind: "FILE" } })), 400);
  assert.equal(await status(() => service.save({ id, document })), 409);
  assert.equal(await status(() => service.check(id)), 400);
  assert.equal(f.calls.length, 0);
});
