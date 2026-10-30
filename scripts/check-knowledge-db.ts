import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { loadEnvConfig } from "@next/env";
import { Prisma, PrismaClient } from "@prisma/client";

loadEnvConfig(process.cwd());

async function main() {
  const { env } = await import("../src/config/env");
  const { KnowledgeRepository } = await import("../src/repositories/knowledge.repository");
  const { KnowledgeManifestSchema } = await import("../src/dtos/knowledge.dto");
  const { tokenizeKnowledge, knowledgeContentHash } = await import("../src/lib/rag/knowledge-index");
  const baseUrl = new URL(env.DIRECT_URL || env.DATABASE_URL);
  baseUrl.searchParams.set("schema", "public");
  const base = new PrismaClient({ datasourceUrl: baseUrl.toString() });
  const schema = `knowledge_rag_test_${randomUUID().replaceAll("-", "")}`;
  assert.match(schema, /^knowledge_rag_test_[a-f0-9]{32}$/);
  const identifier = Prisma.raw(`"${schema}"`);
  const url = new URL(baseUrl);
  url.searchParams.set("schema", schema);
  const db = new PrismaClient({ datasourceUrl: url.toString() });
  const vector = [1, ...Array<number>(1535).fill(0)];
  const orthogonal = [0, 1, ...Array<number>(1534).fill(0)];
  const now = new Date();
  const original = await base.$queryRaw<Array<{ digest: string }>>(Prisma.sql`
    SELECT md5(coalesce(string_agg(to_jsonb(k)::text, '' ORDER BY id), '')) AS digest FROM public.knowledge_items k`);
  try {
    console.log("DB check: create isolated schema");
    await base.$executeRaw(Prisma.sql`CREATE SCHEMA ${identifier}`);
    const init = await readFile("prisma/migrations/20260629000000_init/migration.sql", "utf8");
    const migrations = await Promise.all(["20261013000000_hybrid_knowledge", "20261023120000_knowledge_faq_file"]
      .map((name) => readFile(`prisma/migrations/${name}/migration.sql`, "utf8")));
    const migration = migrations.join("\n");
    const initialTable = init.slice(init.indexOf('CREATE TABLE "knowledge_items"'), init.indexOf('CREATE TABLE "tickets"'));
    await db.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`SET LOCAL search_path TO ${identifier}, public`);
      await tx.$executeRawUnsafe(initialTable);
      await tx.$executeRawUnsafe('CREATE UNIQUE INDEX "knowledge_items_title_key" ON "knowledge_items"("title")');
      for (const statement of migration.replace(/^--.*$/gm, "").split(";").map((part) => part.trim()).filter(Boolean)) {
        await tx.$executeRawUnsafe(statement);
      }
    });
    console.log("DB check: import synthetic evidence");
    const repo = new KnowledgeRepository(db, schema);
    assert.equal(await repo.hasIndexedEvidence(), false);
    const manifest = KnowledgeManifestSchema.parse([{
      title: "Synthetic Registrar", category: "Testing", content: "ขอเอกสารผ่านระบบทดสอบ IT232",
      keywords: ["เอกสาร", "IT232"], sourceUrl: "https://bu.ac.th/synthetic-only",
      sourceHash: "a".repeat(64), verifiedBy: "Synthetic only",
      verifiedAt: new Date(now.getTime() - 60000).toISOString(),
      reviewAfter: new Date(now.getTime() + 86400000).toISOString()
    }])[0];
    const id = await repo.saveReviewedDocument(manifest, [{ content: manifest.content, embedding: vector }]);
    assert.equal(await repo.hasIndexedEvidence(), true);
    const initialAdmin = await repo.listAdminDocuments("", 1, 10);
    assert.deepEqual(initialAdmin.stats, { total: 1, ready: 1, unapproved: 0, review: 0 });
    assert.equal((await repo.readAdminDocument(id))?.chunks[0].content, manifest.content);
    assert.equal((await repo.listAdminDocuments("", 1, 10, { category: "Testing", status: "ready", source: "official", limit: 10 })).total, 1);
    assert.equal((await repo.listAdminDocuments("", 1, 10, { category: "Testing", status: "unapproved", source: "all", limit: 10 })).total, 0);
    console.log("DB check: retrieval");
    const keyword = await repo.hybridSearch("ขอเอกสาร IT232", null, now);
    assert.equal(keyword[0]?.documentId, id);
    assert.equal(keyword[0]?.keywordRank, 1);
    assert.equal(keyword[0]?.vectorRank, null);
    const semantic = await repo.hybridSearch("unrelated-paraphrase", vector, now);
    assert.equal(semantic[0]?.documentId, id);
    assert.equal(semantic[0]?.keywordRank, null);
    assert.equal(semantic[0]?.vectorRank, 1);
    const hybrid = await repo.hybridSearch("เอกสาร", vector, now);
    assert.ok(hybrid[0].score > keyword[0].score);
    assert.deepEqual(await repo.hybridSearch("unrelated-paraphrase", orthogonal, now), []);
    await repo.saveReviewedDocument({ ...manifest, verifiedAt: now }, null);
    assert.equal((await repo.findIndexedDocument(manifest.title))?.chunks.length, 1);
    await assert.rejects(() => repo.saveReviewedDocument({ ...manifest, content: "replacement", verifiedAt: new Date(now.getTime() + 1) },
      [{ content: "replacement", embedding: [1, 2] }]));
    assert.equal((await repo.findIndexedDocument(manifest.title))?.content, manifest.content);
    assert.equal((await repo.hybridSearch("เอกสาร", vector))[0]?.documentId, id);
    await assert.rejects(() => repo.saveReviewedDocument(manifest, [{ content: "older", embedding: vector }]), /older approval/);

    for (const change of [
      { verifiedBy: null }, { verifiedAt: null }, { reviewAfter: new Date(now.getTime() - 1000) },
      { validFrom: new Date(now.getTime() + 86400000) }, { validUntil: new Date(now.getTime() - 1000) },
      { sourceStatus: "CHANGED" }, { content: "edited outside ingestion" }
    ]) {
      await db.knowledgeItem.update({ where: { id }, data: change });
      assert.deepEqual(await repo.hybridSearch("เอกสาร", vector), [], JSON.stringify(change));
      assert.equal((await repo.listAdminDocuments("", 1, 10, { category: "", status: "ready", source: "all", limit: 10 })).total, 0, JSON.stringify(change));
      await repo.saveReviewedDocument({ ...manifest, verifiedAt: now }, [{ content: manifest.content, embedding: vector }]);
    }
    await db.$executeRaw(Prisma.sql`UPDATE ${identifier}.knowledge_chunks SET embedding_model = 'wrong-model'`);
    assert.deepEqual(await repo.hybridSearch("เอกสาร", vector), []);
    await db.$executeRaw(Prisma.sql`UPDATE ${identifier}.knowledge_chunks SET embedding_model = 'text-embedding-3-small'`);
    // More than 100 newer legacy rows must neither hide nor outrank approved evidence.
    await db.knowledgeItem.createMany({ data: Array.from({ length: 120 }, (_, index) => ({
      title: `Unverified ${index}`, category: "Testing", content: "เอกสาร", keywords: ["เอกสาร"]
    })) });
    const adminCorpus = await repo.listAdminDocuments("", 1, 10);
    assert.deepEqual(adminCorpus.stats, { total: 121, ready: 1, unapproved: 120, review: 0 });
    const filteredAdmin = await repo.listAdminDocuments("Unverified", 2, 20, { category: "Testing", status: "unapproved", source: "missing", limit: 20 });
    assert.equal(filteredAdmin.total, 120);
    assert.equal(filteredAdmin.items.length, 20);
    assert.equal(filteredAdmin.stats.total, 121);
    assert.deepEqual(filteredAdmin.categories, ["Testing"]);
    assert.equal((await repo.hybridSearch("เอกสาร", vector))[0]?.documentId, id);
    const chunks = await db.$queryRaw<Array<{ search_text: string; document_hash: string }>>(Prisma.sql`
      SELECT search_text, document_hash FROM ${identifier}.knowledge_chunks`);
    assert.ok(chunks[0].search_text.includes(tokenizeKnowledge("เอกสาร")));
    assert.equal(chunks[0].document_hash, knowledgeContentHash(manifest));
    // Disjoint keyword/vector Top 20 must both reach the reranker.
    await db.$executeRaw(Prisma.sql`INSERT INTO ${identifier}.knowledge_chunks
      (knowledge_item_id, ordinal, content, document_hash, search_text, embedding, embedding_model)
      SELECT ${id}::uuid, n, 'synthetic candidate ' || n, ${knowledgeContentHash(manifest)},
        CASE WHEN n <= 25 THEN 'rerankkeyword' ELSE 'semanticfixture' END,
        CASE WHEN n <= 25 THEN ${JSON.stringify(orthogonal)}::public.vector(1536)
          ELSE ${JSON.stringify(vector)}::public.vector(1536) END, 'text-embedding-3-small'
      FROM generate_series(1, 50) n`);
    const candidates = await repo.hybridSearch("rerankkeyword", vector, now);
    assert.equal(candidates.length, 40);
    assert.equal(candidates.filter((item) => item.similarity === null).length, 20);
    assert.equal(new Set(candidates.map((item) => item.id)).size, 40);
    assert.equal(candidates.filter((item) => item.keywordRank != null).length, 20);
    assert.equal(candidates.filter((item) => item.vectorRank != null).length, 20);
    console.log("DB check: atomic admin bulk metadata and deletion");
    const { KnowledgeAdminService } = await import("../src/services/knowledge-admin.service");
    let embedCalls = 0;
    const admin = new KnowledgeAdminService(repo, undefined, undefined, async (input) => {
      embedCalls++; return { vectors: input.map(() => vector), usage: { total_tokens: 1 }, model: "text-embedding-3-small" };
    });
    const bulkIds: string[] = [];
    for (const title of ["Bulk A", "Bulk B", "Bulk unselected"]) {
      bulkIds.push(await repo.saveReviewedDocument({ ...manifest, title }, [{ content: manifest.content, embedding: vector }]));
    }
    const snapshots = await repo.findBulkDocuments(bulkIds);
    const selected = snapshots.filter((item) => item.id !== bulkIds[2]).map(({ id: selectedId, updatedAt }) => ({ id: selectedId, updatedAt: updatedAt.toISOString() }));
    const unselected = snapshots.find((item) => item.id === bulkIds[2])!;
    const untouchedDocument = await repo.findById(unselected.id);
    const originalVectors = await db.$queryRaw<Array<{ id: string; vector: string }>>(Prisma.sql`SELECT id::text, embedding::text AS vector FROM ${identifier}.knowledge_chunks WHERE knowledge_item_id IN (${Prisma.join(bulkIds.map((value) => Prisma.sql`${value}::uuid`))}) ORDER BY id`);
    await admin.bulk({ action: "update", selection: selected, changes: { keywords: ["bulklexicalunique"] } });
    assert.equal(embedCalls, 0);
    assert.equal((await repo.hybridSearch("bulklexicalunique", null)).length, 2);
    const afterKeywords = await repo.findBulkDocuments(bulkIds);
    for (const item of afterKeywords) {
      const old = snapshots.find((row) => row.id === item.id)!;
      assert.equal(item.content, old.content);
      assert.equal(item.sourceHash, old.sourceHash);
      assert.equal(item.sourceStatus, old.sourceStatus);
      assert.deepEqual(item.verifiedAt, old.verifiedAt);
      assert.deepEqual(item.reviewAfter, old.reviewAfter);
      assert.deepEqual(item.validFrom, old.validFrom);
      assert.deepEqual(item.validUntil, old.validUntil);
    }
    assert.deepEqual(await repo.findById(unselected.id), untouchedDocument);
    assert.deepEqual(await db.$queryRaw(Prisma.sql`SELECT id::text, embedding::text AS vector FROM ${identifier}.knowledge_chunks WHERE knowledge_item_id IN (${Prisma.join(bulkIds.map((value) => Prisma.sql`${value}::uuid`))}) ORDER BY id`), originalVectors);
    const currentSelection = afterKeywords.filter((item) => item.id !== unselected.id).map(({ id: selectedId, updatedAt }) => ({ id: selectedId, updatedAt: updatedAt.toISOString() }));
    // The first update must roll back when a later chunk vector is invalid.
    await assert.rejects(() => repo.updateAdminMetadata(currentSelection, afterKeywords.filter((item) => item.id !== unselected.id).map((item, index) => ({
      id: item.id, category: "Rollback category", keywords: [], contentHash: item.contentHash,
      chunks: item.chunks.map((chunk) => ({ id: chunk.id, searchText: "rollback", embedding: index ? [1, 2] : vector }))
    }))));
    assert.deepEqual(await repo.findBulkDocuments(bulkIds), afterKeywords);
    await assert.rejects(() => admin.bulk({ action: "delete", selection: selected }), /เปลี่ยนแปลง/);
    assert.equal((await repo.findBulkDocuments(bulkIds)).length, 3);
    await admin.bulk({ action: "update", selection: currentSelection, changes: { category: "Bulk new category" } });
    assert.equal(embedCalls, 1);
    const afterCategory = await repo.findBulkDocuments(bulkIds);
    const deleting = afterCategory.filter((item) => item.id !== unselected.id).map(({ id: selectedId, updatedAt }) => ({ id: selectedId, updatedAt: updatedAt.toISOString() }));
    assert.deepEqual(await admin.bulk({ action: "delete", selection: deleting }), { count: 2 });
    assert.equal(await db.knowledgeChunk.count({ where: { knowledgeItemId: { in: deleting.map((item) => item.id) } } }), 0);
    assert.equal((await repo.readAdminDocument(unselected.id))?.chunks.length, 1);
    assert.deepEqual(await repo.findById(unselected.id), untouchedDocument);
    console.log("DB check: FILE source kind");
    const fileId = await repo.saveReviewedDocument({ ...manifest, title: "File FAQ", content: "ไฟล์faqเฉพาะ", keywords: ["ไฟล์faqเฉพาะ"],
      sourceKind: "FILE", actionLinks: [{ label: "ยื่นคำร้อง", url: "https://bulinks.bu.ac.th/service-petition-new/" }] },
    [{ content: "ไฟล์faqเฉพาะ", embedding: vector }]);
    const fileHit = (await repo.hybridSearch("ไฟล์faqเฉพาะ", null)).find((item) => item.documentId === fileId);
    assert.deepEqual(fileHit?.actionLinks, [{ label: "ยื่นคำร้อง", url: "https://bulinks.bu.ac.th/service-petition-new/" }]);
    assert.equal((await repo.listSourcesForCheck()).some((item) => item.id === fileId), false);
    assert.equal((await repo.listOverdueFileDocuments()).some((item) => item.id === fileId), false);
    await db.knowledgeItem.update({ where: { id: fileId }, data: { reviewAfter: new Date(now.getTime() - 1000) } });
    assert.equal((await repo.listOverdueFileDocuments()).some((item) => item.id === fileId), true);
    await db.knowledgeItem.update({ where: { id: fileId }, data: { reviewAfter: new Date(now.getTime() + 86400000) } });
    assert.deepEqual((await repo.hybridSearch("เอกสาร", vector, now))[0]?.actionLinks, []);
    await assert.rejects(() => repo.saveReviewedDocument({ ...manifest, title: "File FAQ", sourceKind: "PAGE" }, null), /source kind|belongs to a FILE/);
    assert.ok((await repo.listAdminDocuments("File FAQ", 1, 10, { category: "", status: "ready", source: "all", limit: 10 })).total >= 1);
    console.log("PASS: FILE source kind, overdue FILE review, action links, kind-change refusal; RAG retrieval and approval invariants; admin filters/counts; atomic bulk metadata, stale-selection refusal, cascade deletion and unselected preservation");
  } finally {
    await db.$executeRawUnsafe("SET search_path TO public");
    await db.$disconnect();
    await base.$executeRaw(Prisma.sql`DROP SCHEMA IF EXISTS ${identifier} CASCADE`);
    const after = await base.$queryRaw<Array<{ digest: string }>>(Prisma.sql`
      SELECT md5(coalesce(string_agg(to_jsonb(k)::text, '' ORDER BY id), '')) AS digest FROM public.knowledge_items k`);
    assert.deepEqual(after, original, "Existing public knowledge must remain unchanged");
    await base.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Knowledge DB verification failed; synthetic schema cleanup attempted", error instanceof Prisma.PrismaClientKnownRequestError
    ? { code: error.code, details: error.meta?.message } : error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
});
