import { knowledgeContentHash } from "@/lib/knowledge-index";
import { knowledgeEmbeddingModel } from "@/lib/knowledge-embedding";
import { fetchKnowledgeSource } from "@/lib/knowledge-source";
import type { KnowledgeSave, KnowledgeFilters } from "@/src/dtos/knowledge-admin.dto";
import { officialKnowledgeUrlSchema } from "@/src/dtos/knowledge.dto";
import { knowledgeRepository, type KnowledgeRepository } from "@/src/repositories/knowledge.repository";
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
    private repo: Pick<KnowledgeRepository, "listAdminDocuments" | "readAdminDocument" | "findById" | "findIndexedDocument"> = knowledgeRepository,
    private ingestion: Pick<KnowledgeIngestionService, "importReviewedDocument" | "checkSources"> = knowledgeIngestionService,
    private fetchSource = fetchKnowledgeSource
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
