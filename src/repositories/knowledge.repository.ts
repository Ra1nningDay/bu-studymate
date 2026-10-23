import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { knowledgeEmbeddingModel, knowledgeVectorSchema } from "@/lib/knowledge-embedding";
import { knowledgeContentHash, tokenizeKnowledge } from "@/lib/knowledge-index";
import type { ActionLink, KnowledgeDocument } from "@/src/dtos/knowledge.dto";
import type { KnowledgeFilters, KnowledgeSelection } from "@/src/dtos/knowledge-admin.dto";
import type { KnowledgeItem } from "@/lib/types";

export type KnowledgeEvidence = KnowledgeItem & {
  documentId: string;
  sourceUrl: string;
  verifiedAt: Date;
  validFrom: Date | null;
  validUntil: Date | null;
  score: number;
  similarity: number | null;
  keywordRank?: number | null;
  vectorRank?: number | null;
  actionLinks?: ActionLink[];
};

export type KnowledgeMetadataUpdate = {
  id: string; category: string; keywords: string[]; contentHash: string | null;
  chunks: Array<{ id: string; searchText: string; embedding?: number[] }>;
};

export class KnowledgeRepository {
  private items: Prisma.Sql;
  private chunks: Prisma.Sql;

  constructor(private db: Prisma.TransactionClient = prisma, schema = "public") {
    const quoted = schema.replaceAll('"', '""');
    this.items = Prisma.raw(`"${quoted}"."knowledge_items"`);
    this.chunks = Prisma.raw(`"${quoted}"."knowledge_chunks"`);
  }

  async listKnowledgeItems(take = 100) {
    return this.db.knowledgeItem.findMany({ take, orderBy: { updatedAt: "desc" } });
  }

  async findById(id: string) {
    return this.db.knowledgeItem.findUnique({ where: { id } });
  }

  async readAdminDocument(id: string) {
    return this.db.knowledgeItem.findUnique({ where: { id }, select: { id: true, chunks: {
      select: { id: true, ordinal: true, content: true, embeddingModel: true }, orderBy: { ordinal: "asc" }
    } } });
  }

  async findBulkDocuments(ids: string[]) {
    return this.db.knowledgeItem.findMany({ where: { id: { in: ids } }, include: { chunks: {
      select: { id: true, ordinal: true, content: true, embeddingModel: true, documentHash: true }, orderBy: { ordinal: "asc" }
    } } });
  }

  private async mutateSelection(selection: KnowledgeSelection, mutate: (tx: Prisma.TransactionClient) => Promise<number>) {
    const write = async (tx: Prisma.TransactionClient) => {
      const current = await tx.knowledgeItem.findMany({ where: { id: { in: selection.map((item) => item.id) } }, select: { id: true, updatedAt: true } });
      if (current.length !== selection.length || selection.some((item) =>
        current.find((row) => row.id === item.id)?.updatedAt.getTime() !== new Date(item.updatedAt).getTime())) {
        throw new Error("Selected documents changed; refresh before saving");
      }
      return mutate(tx);
    };
    return "$transaction" in this.db
      ? (this.db as PrismaClient).$transaction(write, { isolationLevel: "Serializable", timeout: 20000 })
      : write(this.db);
  }

  async deleteAdminDocuments(selection: KnowledgeSelection) {
    return this.mutateSelection(selection, async (tx) => {
      const { count } = await tx.knowledgeItem.deleteMany({ where: { id: { in: selection.map((item) => item.id) } } });
      return count;
    });
  }

  async updateAdminMetadata(selection: KnowledgeSelection, documents: KnowledgeMetadataUpdate[]) {
    return this.mutateSelection(selection, async (tx) => {
      for (const item of documents) {
        await tx.knowledgeItem.update({ where: { id: item.id }, data: { category: item.category, keywords: item.keywords, contentHash: item.contentHash } });
      }
      const chunks = documents.flatMap((document) => document.chunks.map((chunk) => Prisma.sql`
        (${chunk.id}::uuid, ${document.contentHash}::text, ${chunk.searchText}::text,
          ${chunk.embedding ? JSON.stringify(knowledgeVectorSchema.parse(chunk.embedding)) : null}::public.vector(1536))
      `));
      if (chunks.length) await tx.$executeRaw(Prisma.sql`
        UPDATE ${this.chunks} c SET document_hash = p.hash, search_text = p.text,
          embedding = coalesce(p.embedding, c.embedding)
        FROM (VALUES ${Prisma.join(chunks)}) AS p(id, hash, text, embedding) WHERE c.id = p.id
      `);
      return documents.length;
    });
  }

  async listAdminDocuments(search: string, page: number, limit: number, filters?: KnowledgeFilters) {
    const now = new Date();
    const summary = await this.db.$queryRaw<Array<{ id: string; category: string; status: "ready" | "unapproved" | "review"; source: "official" | "legacy" | "missing" }>>(Prisma.sql`
      SELECT k.id::text, k.category,
        CASE WHEN coalesce(k.verified_by, '') = '' OR k.verified_at IS NULL OR k.source_hash IS NULL OR k.source_url IS NULL THEN 'unapproved'
          WHEN k.verified_by <> '' AND k.verified_at <= ${now} AND k.review_after > ${now}
            AND (k.valid_from IS NULL OR k.valid_from <= ${now})
            AND (k.valid_until IS NULL OR k.valid_until > ${now})
            AND k.source_status = 'UNCHANGED'
            AND k.source_url ~* '^https://([a-z0-9-]+[.])*bu[.]ac[.]th([/?][^#]*)?$'
            AND k.content_hash = md5(k.title || chr(10) || k.category || chr(10) ||
              array_to_string(k.keywords, chr(10)) || chr(10) || k.content || chr(10) || k.source_url)
            AND EXISTS (SELECT 1 FROM ${this.chunks} c WHERE c.knowledge_item_id = k.id
              AND c.embedding_model = ${knowledgeEmbeddingModel} AND c.document_hash = k.content_hash)
          THEN 'ready' ELSE 'review' END AS status,
        CASE WHEN k.source_url ~* '^https://([a-z0-9-]+[.])*bu[.]ac[.]th([/?][^#]*)?$' THEN 'official'
          WHEN coalesce(k.source_url, k.source, '') = '' THEN 'missing' ELSE 'legacy' END AS source
      FROM ${this.items} k
    `);
    const ids = summary.filter((item) => (!filters?.category || item.category === filters.category) &&
      (!filters?.status || filters.status === "all" || item.status === filters.status) &&
      (!filters?.source || filters.source === "all" || item.source === filters.source)).map((item) => item.id);
    const where: Prisma.KnowledgeItemWhereInput = { id: { in: ids }, ...(search ? { OR: [
      { title: { contains: search, mode: "insensitive" } },
      { category: { contains: search, mode: "insensitive" } },
      { content: { contains: search, mode: "insensitive" } },
      { keywords: { has: search } }
    ] } : {}) };
    const [items, total] = await Promise.all([
      this.db.knowledgeItem.findMany({ where, skip: (page - 1) * limit, take: limit,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        include: { chunks: { select: { embeddingModel: true, documentHash: true } } } }),
      this.db.knowledgeItem.count({ where })
    ]);
    return { items, total, categories: [...new Set(summary.map((item) => item.category))].sort(),
      stats: { total: summary.length, ready: summary.filter((item) => item.status === "ready").length,
        unapproved: summary.filter((item) => item.status === "unapproved").length,
        review: summary.filter((item) => item.status === "review").length } };
  }

  async hasIndexedEvidence(now = new Date()) {
    return (await this.db.knowledgeChunk.count({ where: {
      embeddingModel: knowledgeEmbeddingModel,
      knowledgeItem: { verifiedBy: { not: null }, verifiedAt: { lte: now },
        reviewAfter: { gt: now }, sourceStatus: "UNCHANGED", sourceHash: { not: null },
        sourceUrl: { not: null }, AND: [
          { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
          { OR: [{ validUntil: null }, { validUntil: { gt: now } }] }
        ] }
    } })) > 0;
  }

  async hybridSearch(query: string, embedding: number[] | null, now = new Date()) {
    const vector = embedding ? JSON.stringify(knowledgeVectorSchema.parse(embedding)) : null;
    const tokens = tokenizeKnowledge(query).split(" ").filter(Boolean);
    if (!tokens.length && !vector) return [];
    return this.db.$queryRaw<KnowledgeEvidence[]>(Prisma.sql`
      WITH eligible AS MATERIALIZED (
        SELECT c.*, k.title, k.category, k.keywords, k.source_url, k.verified_at,
          k.valid_from, k.valid_until, k.created_at, k.updated_at, k.action_links
        FROM ${this.chunks} c JOIN ${this.items} k ON k.id = c.knowledge_item_id
        WHERE k.verified_by IS NOT NULL AND k.verified_at <= ${now}
          AND k.review_after > ${now}
          AND (k.valid_from IS NULL OR k.valid_from <= ${now})
          AND (k.valid_until IS NULL OR k.valid_until > ${now})
          AND k.source_status = 'UNCHANGED' AND k.source_hash IS NOT NULL
          AND k.source_url IS NOT NULL AND c.embedding_model = ${knowledgeEmbeddingModel}
          AND c.document_hash = k.content_hash
          AND k.content_hash = md5(k.title || chr(10) || k.category || chr(10) ||
            array_to_string(k.keywords, chr(10)) || chr(10) || k.content || chr(10) || k.source_url)
      ), query AS (
        SELECT websearch_to_tsquery('simple', ${tokens.join(" OR ")}) AS terms,
          ${vector}::public.vector(1536) AS embedding
      ), lexical AS (
        SELECT e.id, row_number() OVER (ORDER BY ts_rank_cd(e.search_vector, q.terms) DESC, e.id) AS rank
        FROM eligible e CROSS JOIN query q WHERE e.search_vector @@ q.terms
        ORDER BY ts_rank_cd(e.search_vector, q.terms) DESC, e.id LIMIT 20
      ), semantic AS (
        SELECT e.id, 1 - (e.embedding OPERATOR(public.<=>) q.embedding) AS similarity,
          row_number() OVER (ORDER BY e.embedding OPERATOR(public.<=>) q.embedding, e.id) AS rank
        FROM eligible e CROSS JOIN query q
        WHERE q.embedding IS NOT NULL AND 1 - (e.embedding OPERATOR(public.<=>) q.embedding) >= 0.65
        ORDER BY e.embedding OPERATOR(public.<=>) q.embedding, e.id LIMIT 20
      ), fused AS (
        SELECT coalesce(l.id, s.id) AS id, s.similarity, l.rank AS keyword_rank, s.rank AS vector_rank,
          coalesce(1.0 / (60 + l.rank), 0) + coalesce(1.0 / (60 + s.rank), 0) AS score
        FROM lexical l FULL OUTER JOIN semantic s ON l.id = s.id
      )
      SELECT e.id::text, e.knowledge_item_id::text AS "documentId", e.title, e.category,
        e.content, e.keywords, e.source_url AS source, e.source_url AS "sourceUrl",
        e.verified_at AS "verifiedAt", e.valid_from AS "validFrom", e.valid_until AS "validUntil",
        e.action_links AS "actionLinks", e.created_at::text AS created_at, e.updated_at::text AS updated_at,
        f.score::float8, f.similarity::float8,
        f.keyword_rank::int AS "keywordRank", f.vector_rank::int AS "vectorRank"
      FROM fused f JOIN eligible e ON e.id = f.id
      ORDER BY f.score DESC, e.id LIMIT 40
    `);
  }

  async findIndexedDocument(title: string) {
    return this.db.knowledgeItem.findUnique({ where: { title }, include: {
      chunks: { select: { content: true, embeddingModel: true }, orderBy: { ordinal: "asc" } }
    } });
  }

  async saveReviewedDocument(item: KnowledgeDocument, passages: Array<{ content: string; embedding: number[] }> | null, expectedId?: string | null) {
    const contentHash = knowledgeContentHash(item);
    const save = async (tx: Prisma.TransactionClient) => {
      const previous = await tx.knowledgeItem.findUnique({ where: { title: item.title } });
      // The CLI upserts by title; admin saves must stay bound to the selected identity.
      if (expectedId !== undefined && (previous?.id ?? null) !== expectedId) {
        throw new Error("Document identity changed; refresh before saving");
      }
      if (previous?.verifiedAt && previous.verifiedAt > item.verifiedAt) {
        throw new Error("An older approval cannot replace a newer document");
      }
      if (previous?.verifiedAt?.getTime() === item.verifiedAt.getTime() && previous.contentHash !== contentHash) {
        throw new Error("Changed content needs a newer approval");
      }
      if (!passages && previous?.contentHash !== contentHash) {
        throw new Error("Document changed during import; rerun preparation");
      }
      const document = await tx.knowledgeItem.upsert({
        where: { title: item.title },
        create: { ...item, contentHash, source: item.sourceUrl, sourceStatus: "UNCHANGED", sourceCheckedAt: new Date() },
        update: { ...item, validFrom: item.validFrom ?? null, validUntil: item.validUntil ?? null,
          contentHash, source: item.sourceUrl, sourceStatus: "UNCHANGED", sourceCheckedAt: new Date() }
      });
      if (passages) {
        await tx.knowledgeChunk.deleteMany({ where: { knowledgeItemId: document.id } });
        for (const [ordinal, passage] of passages.entries()) {
          const vector = JSON.stringify(knowledgeVectorSchema.parse(passage.embedding));
          const searchText = tokenizeKnowledge(`${item.title}\n${item.category}\n${item.keywords.join(" ")}\n${passage.content}`);
          await tx.$executeRaw(Prisma.sql`
            INSERT INTO ${this.chunks} (knowledge_item_id, ordinal, content, document_hash,
              search_text, embedding, embedding_model)
            VALUES (${document.id}::uuid, ${ordinal}, ${passage.content}, ${contentHash},
              ${searchText}, ${vector}::public.vector(1536), ${knowledgeEmbeddingModel})
          `);
        }
      }
      return document.id;
    };
    return "$transaction" in this.db
      ? (this.db as PrismaClient).$transaction(save, { isolationLevel: "Serializable", timeout: 20000 })
      : save(this.db);
  }

  async listSourcesForCheck(id?: string) {
    return this.db.knowledgeItem.findMany({ where: { id, sourceKind: "PAGE", verifiedAt: { not: null }, sourceUrl: { not: null } },
      take: 20, orderBy: { sourceCheckedAt: { sort: "asc", nulls: "first" } },
      select: { id: true, sourceUrl: true, sourceHash: true, reviewAfter: true } });
  }

  async recordSourceCheck(id: string, expectedHash: string, status: string) {
    return this.db.knowledgeItem.updateMany({
      where: { id, sourceHash: expectedHash },
      data: { sourceStatus: status, sourceCheckedAt: new Date() }
    });
  }
}

export const knowledgeRepository = new KnowledgeRepository();
