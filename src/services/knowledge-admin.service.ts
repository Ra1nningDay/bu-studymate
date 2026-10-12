import { Prisma } from "@prisma/client";
import { knowledgeContentHash, knowledgeEmbeddingText, splitKnowledgeContent, tokenizeKnowledge } from "@/lib/knowledge-index";
import { embedKnowledge, knowledgeEmbeddingModel } from "@/lib/knowledge-embedding";
import { fetchKnowledgeSource } from "@/lib/knowledge-source";
import type { KnowledgeSave, KnowledgeFilters, KnowledgeBulk } from "@/src/dtos/knowledge-admin.dto";
import { officialKnowledgeUrlSchema } from "@/src/dtos/knowledge.dto";
import { knowledgeRepository, type KnowledgeRepository, type KnowledgeMetadataUpdate } from "@/src/repositories/knowledge.repository";
import { knowledgeIngestionService, type KnowledgeIngestionService } from "./knowledge-ingestion.service";

export class KnowledgeAdminError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

type AdminDocument = Awaited<ReturnType<KnowledgeRepository["listAdminDocuments"]>>["items"][number];

export function knowledgeAvailability(item: AdminDocument, now = new Date()) {
  if (!item.verifiedBy || !item.verifiedAt || !item.sourceUrl || !item.sourceHash) return "ยังไม่ผ่านการตรวจทาน";
  if (!officialKnowledgeUrlSchema.safeParse(item.sourceUrl).success) return "แหล่งอ้างอิงไม่ใช่เว็บไซต์ BU ที่รองรับ";
  if (item.verifiedAt > now) return "วันตรวจทานอยู่ในอนาคต";
  if (!item.reviewAfter || item.reviewAfter <= now) return "ถึงกำหนดตรวจทานใหม่";
  if (item.validFrom && item.validFrom > now) return "ยังไม่ถึงช่วงใช้งาน";
  if (item.validUntil && item.validUntil <= now) return "หมดอายุ";
  if (item.sourceStatus !== "UNCHANGED") return item.sourceStatus === "CHANGED" ? "แหล่งข้อมูลเปลี่ยนแปลง" : "ยังยืนยันแหล่งข้อมูลไม่ได้";
  if (item.contentHash !== knowledgeContentHash({ ...item, sourceUrl: item.sourceUrl })) return "เนื้อหาไม่ตรงกับดัชนี";
  if (!item.chunks.some((chunk) => chunk.documentHash === item.contentHash && chunk.embeddingModel === knowledgeEmbeddingModel)) return "ยังไม่มีดัชนีที่ใช้ได้";
  return "พร้อมใช้ใน RAG";
}

export class KnowledgeAdminService {
  constructor(
    private repo: Pick<KnowledgeRepository, "listAdminDocuments" | "readAdminDocument" | "findById" | "findIndexedDocument" | "findBulkDocuments" | "deleteAdminDocuments" | "updateAdminMetadata"> = knowledgeRepository,
    private ingestion: Pick<KnowledgeIngestionService, "importReviewedDocument" | "checkSources"> = knowledgeIngestionService,
    private fetchSource = fetchKnowledgeSource,
    private embed = embedKnowledge
  ) {}

  async list(search: string, page: number, filters: KnowledgeFilters = { category: "", status: "all", source: "all", limit: 10 }) {
    const { limit } = filters;
    let records = await this.repo.listAdminDocuments(search, page, limit, filters);
    if (page > 1 && (page - 1) * limit >= records.total) {
      page = Math.max(1, Math.ceil(records.total / limit));
      records = await this.repo.listAdminDocuments(search, page, limit, filters);
    }
    const { items, total, stats, categories } = records;
    return { items: items.map(({ chunks, ...item }) => ({ ...item,
      createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString(),
      verifiedAt: item.verifiedAt?.toISOString() ?? null, reviewAfter: item.reviewAfter?.toISOString() ?? null,
      validFrom: item.validFrom?.toISOString() ?? null, validUntil: item.validUntil?.toISOString() ?? null,
      sourceCheckedAt: item.sourceCheckedAt?.toISOString() ?? null, chunkCount: chunks.length,
      availability: knowledgeAvailability({ ...item, chunks }) })), total, stats, categories, page, limit };
  }

  async read(id: string) {
    const document = await this.repo.readAdminDocument(id);
    if (!document) throw new KnowledgeAdminError("ไม่พบบทความ", 404);
    return document;
  }

  async bulk(input: KnowledgeBulk) {
    try {
      if (input.action === "delete") return { count: await this.repo.deleteAdminDocuments(input.selection) };
      const records = await this.repo.findBulkDocuments(input.selection.map((item) => item.id));
      if (records.length !== input.selection.length || records.some((item) =>
        new Date(input.selection.find((selected) => selected.id === item.id)?.updatedAt ?? "").getTime() !== item.updatedAt.getTime())) {
        throw new Error("Selected documents changed; refresh before saving");
      }
      const updates: KnowledgeMetadataUpdate[] = [];
      const requests: Array<{ text: string; chunk: KnowledgeMetadataUpdate["chunks"][number] }> = [];
      for (const previous of records) {
        const item = { ...previous, category: input.changes.category ?? previous.category, keywords: input.changes.keywords ?? previous.keywords };
        if (item.category === previous.category && JSON.stringify(item.keywords) === JSON.stringify(previous.keywords)) continue;
        const parts = splitKnowledgeContent(previous.content);
        const indexed = Boolean(previous.sourceUrl) && previous.contentHash === knowledgeContentHash({ ...previous, sourceUrl: previous.sourceUrl! }) &&
          previous.chunks.length > 0 && previous.chunks.length === parts.length && previous.chunks.every((chunk, index) =>
            chunk.documentHash === previous.contentHash && chunk.embeddingModel === knowledgeEmbeddingModel && chunk.content === parts[index]);
        const update: KnowledgeMetadataUpdate = { id: item.id, category: item.category, keywords: item.keywords,
          contentHash: indexed ? knowledgeContentHash({ ...item, sourceUrl: item.sourceUrl! }) : null, chunks: [] };
        if (indexed) for (const original of previous.chunks) {
          const chunk: KnowledgeMetadataUpdate["chunks"][number] = { id: original.id,
            searchText: tokenizeKnowledge(`${item.title}\n${item.category}\n${item.keywords.join(" ")}\n${original.content}`) };
          update.chunks.push(chunk);
          if (item.category !== previous.category) requests.push({ text: knowledgeEmbeddingText(item, original.content), chunk });
        }
        updates.push(update);
      }
      // Prepare outside the transaction; the adapter accepts at most 32 passages per call.
      for (let offset = 0; offset < requests.length; offset += 32) {
        const batch = requests.slice(offset, offset + 32);
        const { vectors } = await this.embed(batch.map((request) => request.text));
        if (vectors.length !== batch.length) throw new Error("Missing passage embeddings");
        batch.forEach((request, index) => { request.chunk.embedding = vectors[index]; });
      }
      return { count: await this.repo.updateAdminMetadata(input.selection, updates) };
    } catch (error) {
      if ((error instanceof Error && error.message.startsWith("Selected documents changed")) ||
        (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034")) {
        throw new KnowledgeAdminError("มีบทความเปลี่ยนแปลงหรือหายไป กรุณารีเฟรชและเลือกใหม่ ยังไม่ได้เปลี่ยนข้อมูลชุดนี้", 409);
      }
      throw error;
    }
  }

  async save({ id, document }: KnowledgeSave) {
    if (id) {
      const previous = await this.repo.findById(id);
      if (!previous) throw new KnowledgeAdminError("ไม่พบบทความ กรุณารีเฟรชรายการ", 404);
      if (previous.title !== document.title) throw new KnowledgeAdminError("การแก้ไขต้องคงชื่อบทความเดิม", 409);
    } else if (await this.repo.findIndexedDocument(document.title)) {
      throw new KnowledgeAdminError("ชื่อบทความนี้มีอยู่แล้ว กรุณาเลือกแก้ไขจากรายการ", 409);
    }
    try { return await this.ingestion.importReviewedDocument(document, id ?? null); }
    catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/Document identity changed|older approval|newer approval|changed during import/.test(message)) {
        throw new KnowledgeAdminError("บทความมีการเปลี่ยนแปลงหรือการตรวจทานใหม่กว่า กรุณารีเฟรชและตรวจทานอีกครั้ง", 409);
      }
      if (message.startsWith("Source changed since review")) {
        throw new KnowledgeAdminError("แหล่งข้อมูลเปลี่ยนหลังตรวจทาน กรุณาเปิดอ่านและดึง snapshot ใหม่", 409);
      }
      if (message.includes("future approvals or overdue reviews")) {
        throw new KnowledgeAdminError("วันตรวจทานต้องไม่อยู่ในอนาคต และวันตรวจทานครั้งถัดไปต้องยังไม่ถึงกำหนด", 400);
      }
      throw error;
    }
  }

  async snapshot(sourceUrl: string) { return this.fetchSource(sourceUrl); }

  async check(id: string) {
    const item = await this.repo.findById(id);
    if (!item) throw new KnowledgeAdminError("ไม่พบบทความ", 404);
    if (!item.verifiedAt || !item.sourceUrl || !item.sourceHash) {
      throw new KnowledgeAdminError("เพิ่มแหล่งอ้างอิงและตรวจทานบทความก่อนตรวจแหล่งข้อมูล", 400);
    }
    const [result] = await this.ingestion.checkSources(id);
    if (!result) throw new KnowledgeAdminError("บทความเปลี่ยนแปลงระหว่างตรวจ กรุณารีเฟรช", 409);
    return result;
  }
}

export const knowledgeAdminService = new KnowledgeAdminService();
export type KnowledgeAdminList = Awaited<ReturnType<KnowledgeAdminService["list"]>>;
