import type { AiUsageEntry } from "@/src/dtos/ai-usage.dto";
import { rewriteKnowledgeAnswer } from "@/lib/ai";
import { embedKnowledge } from "@/lib/knowledge-embedding";
import { rerankKnowledge } from "@/lib/knowledge-rerank";
import { rewriteKnowledgeQuery } from "@/lib/knowledge-query";
import { officialKnowledgeUrlSchema } from "@/src/dtos/knowledge.dto";
import { appendActionLinks } from "@/src/presenters/knowledge-answer.presenter";
import { knowledgeRepository, type KnowledgeRepository } from "@/src/repositories/knowledge.repository";
import type { KnowledgeItem } from "@/lib/types";
import type { ExecutionLogEntry } from "@/src/dtos/playground.dto";

const FALLBACK_NO_INFO =
  "ขออภัยครับ ตอนนี้ StudyMate ยังไม่มีข้อมูลที่ยืนยันได้เพียงพอสำหรับคำถามนี้";

export class KnowledgeService {
  constructor(
    private repo: Pick<KnowledgeRepository, "hybridSearch" | "hasIndexedEvidence"> = knowledgeRepository,
    private embed = embedKnowledge,
    private rewrite = rewriteKnowledgeAnswer,
    private rerank = rerankKnowledge,
    private rewriteQuery = rewriteKnowledgeQuery
  ) {}

  async retrieve(query: string, history: Array<{ content: string; role: "assistant" | "user" }> = []) {
    const trace: ExecutionLogEntry[] = [];
    const usageEntries: AiUsageEntry[] = [];
    if (!query.trim() || Buffer.byteLength(query, "utf8") > 7500 || !await this.repo.hasIndexedEvidence()) {
      trace.push({ action: "Hybrid Retrieval", status: "skipped", details: "ไม่มีคำถามที่ค้นได้หรือไม่มี corpus ที่อนุมัติ" });
      return { items: [], usage: undefined, model: undefined, trace, usageEntries };
    }
    const rewriteStarted = performance.now();
    const rewritten = await this.rewriteQuery(query, history);
    if (rewritten.usage && rewritten.model) usageEntries.push({ provider: "openai", model: rewritten.model, step: "query_rewrite", usage: rewritten.usage });
    trace.push({ action: "Query Rewrite", status: rewritten.status,
      durationMs: Math.round(performance.now() - rewriteStarted),
      details: rewritten.status === "applied" ? "สร้างคำถามสำหรับค้นจากบริบทสนทนา" : "ใช้คำถามเดิม",
      rag: { originalQuery: query, query: rewritten.query, model: rewritten.model, tokens: rewritten.usage?.total_tokens } });
    const retrievalStarted = performance.now();
    let embedding: number[] | null = null;
    let usage = rewritten.usage;
    let model: string | undefined;
    let embeddingTokens: number | undefined;
    try {
      const result = await this.embed([rewritten.query]);
      embedding = result.vectors[0];
      usage = { total_tokens: (usage?.total_tokens ?? 0) + result.usage.total_tokens };
      model = result.model;
      embeddingTokens = result.usage.total_tokens;
      usageEntries.push({ provider: "openai", model: result.model, step: "embedding",
        usage: { total_tokens: embeddingTokens, prompt_tokens: embeddingTokens, completion_tokens: 0 } });
    } catch {
      console.warn("Knowledge embedding unavailable; using current approved keyword evidence");
    }
    const evidence = await this.repo.hybridSearch(rewritten.query, embedding);
    const candidates = evidence.filter((item) => officialKnowledgeUrlSchema.safeParse(item.sourceUrl).success);
    const keywordCount = evidence.every((item) => item.keywordRank !== undefined)
      ? evidence.filter((item) => item.keywordRank != null).length : undefined;
    const vectorCount = evidence.every((item) => item.vectorRank !== undefined)
      ? evidence.filter((item) => item.vectorRank != null).length : undefined;
    trace.push({ action: "Hybrid Retrieval", status: embedding ? "applied" : "fallback",
      durationMs: Math.round(performance.now() - retrievalStarted),
      details: `${embedding ? "Keyword + vector" : "Keyword เท่านั้น"} · ${candidates.length} candidates ที่ใช้ได้`,
      rag: { query: rewritten.query, model, tokens: embeddingTokens, keywordCount, vectorCount } });
    const chunks = candidates.slice(0, 40).map((item, index) => ({
      id: item.id, title: item.title, sourceUrl: item.sourceUrl, content: item.content,
      rank: index + 1, keywordRank: item.keywordRank, vectorRank: item.vectorRank,
      rrfScore: item.score, similarity: item.similarity
    }));
    trace.push({ action: "RRF Fusion", status: candidates.length ? "applied" : "skipped",
      details: `${chunks.length} candidates หลังรวม · constant 60 · เวลารวมอยู่ใน Hybrid Retrieval (SQL)`,
      rag: { chunks } });
    const rerankStarted = performance.now();
    const ranked = await this.rerank(rewritten.query, candidates);
    if (ranked.usage && ranked.model) usageEntries.push({ provider: "openai", model: ranked.model, step: "rerank", usage: ranked.usage });
    trace.push({ action: "Reranker", status: ranked.status,
      durationMs: Math.round(performance.now() - rerankStarted),
      details: `${ranked.status === "applied" ? "LLM ranking" : "RRF order"} · เลือก ${ranked.items.length} จาก ${chunks.length} chunks`,
      rag: { model: ranked.model, tokens: ranked.usage?.total_tokens,
        chunks: ranked.items.map((item, index) => ({ ...chunks.find((chunk) => chunk.id === item.id)!, selectedRank: index + 1 })) } });
    if (ranked.usage) usage = { total_tokens: (usage?.total_tokens ?? 0) + ranked.usage.total_tokens };
    return { items: ranked.items, usage, model, rerankModel: ranked.model, rerankStatus: ranked.status,
      queryRewriteModel: rewritten.model, queryRewriteStatus: rewritten.status, trace, usageEntries };
  }

  async search(query: string): Promise<KnowledgeItem | null> {
    return (await this.retrieve(query)).items[0] ?? null;
  }

  async answerQuestion(
    query: string,
    history: Array<{ content: string; role: "assistant" | "user" }> = [],
    options: { onTextDelta?: (delta: string) => void; onTextReset?: () => void } = {}
  ) {
    const retrieval = await this.retrieve(query, history);
    const evidence = retrieval.items;
    const metadata = { retrievalModel: retrieval.model, rerankModel: retrieval.rerankModel, rerankStatus: retrieval.rerankStatus,
      queryRewriteModel: retrieval.queryRewriteModel, queryRewriteStatus: retrieval.queryRewriteStatus, trace: retrieval.trace, usageEntries: retrieval.usageEntries };
    if (!evidence.length) {
      retrieval.trace.push({ action: "LLM Generation", status: "skipped", details: "ไม่มีหลักฐานสำหรับสร้างคำตอบ" });
      return { text: FALLBACK_NO_INFO, sources: [], usage: retrieval.usage, model: undefined,
        ...metadata, isMiss: true };
    }
    let result: Awaited<ReturnType<typeof rewriteKnowledgeAnswer>>;
    const generationStarted = performance.now();
    try {
      result = await this.rewrite({
        evidence,
        history,
        onTextDelta: options.onTextDelta,
        onTextReset: options.onTextReset,
        question: query
      });
    } catch {
      retrieval.trace.push({ action: "LLM Generation", status: "error",
        durationMs: Math.round(performance.now() - generationStarted), details: "สร้างคำตอบไม่สำเร็จ" });
      return { text: FALLBACK_NO_INFO, sources: [], usage: retrieval.usage, model: undefined,
        ...metadata, isMiss: true };
    }
    retrieval.trace.push({ action: "LLM Generation", status: result.text === "NO_VERIFIED_INFO_FOUND" ? "fallback" : "applied",
      durationMs: Math.round(performance.now() - generationStarted),
      details: `ใช้ ${evidence.length} chunks · ${result.sources.length} citations`,
      rag: { model: result.model, tokens: result.usage?.total_tokens,
        chunks: retrieval.trace.find((step) => step.action === "Reranker")?.rag?.chunks } });
    if (result.usage && result.model) retrieval.usageEntries.push({ provider: "openai", model: result.model, step: "answer", usage: result.usage });
    if (retrieval.usage) result.usage = { total_tokens: retrieval.usage.total_tokens + (result.usage?.total_tokens ?? 0) };
    if (result.text === "NO_VERIFIED_INFO_FOUND") {
      return { ...result, text: FALLBACK_NO_INFO, sources: [], ...metadata, isMiss: true };
    }
    return { ...result, text: appendActionLinks(result.text, result.actionLinks ?? []), ...metadata, isMiss: false };
  }
}

export const knowledgeService = new KnowledgeService();
