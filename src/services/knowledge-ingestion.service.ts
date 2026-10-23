import { KnowledgeManifestSchema, type KnowledgeDocument } from "@/src/dtos/knowledge.dto";
import { knowledgeRepository, type KnowledgeRepository } from "@/src/repositories/knowledge.repository";
import { embedKnowledge, knowledgeEmbeddingModel } from "@/lib/knowledge-embedding";
import { knowledgeContentHash, knowledgeEmbeddingText, splitKnowledgeContent } from "@/lib/knowledge-index";
import { fetchKnowledgeSource } from "@/lib/knowledge-source";

export class KnowledgeIngestionService {
  constructor(
    private repo: Pick<KnowledgeRepository, "findIndexedDocument" | "saveReviewedDocument" | "listSourcesForCheck" | "recordSourceCheck" | "listOverdueFileDocuments"> = knowledgeRepository,
    private embed = embedKnowledge,
    private fetchSource = fetchKnowledgeSource
  ) {}

  async importManifest(input: unknown, now = new Date()) {
    const documents = KnowledgeManifestSchema.parse(input);
    if (documents.some((item) => item.verifiedAt > now || item.reviewAfter <= now)) {
      throw new Error("Cannot import future approvals or overdue reviews");
    }
    // Fail before any write: a title owned by another source kind would silently convert that document.
    for (const item of documents) {
      const previous = await this.repo.findIndexedDocument(item.title);
      if (previous && previous.sourceKind !== item.sourceKind) {
        throw new Error(`Title already belongs to a ${previous.sourceKind} document: ${item.title}`);
      }
    }
    const results: Array<{ id: string; chunks: number; embedded: boolean }> = [];
    for (const item of documents) {
      results.push(await this.importReviewedDocument(item, undefined, now));
    }
    return results;
  }

  async importReviewedDocument(item: KnowledgeDocument, expectedId?: string | null, now = new Date()) {
    if (item.verifiedAt > now || item.reviewAfter <= now) {
      throw new Error("Cannot import future approvals or overdue reviews");
    }
    if (item.sourceKind === "PAGE") {
      const snapshot = await this.fetchSource(item.sourceUrl);
      if (snapshot.sourceHash !== item.sourceHash) throw new Error(`Source changed since review: ${item.title}`);
    }
    const content = splitKnowledgeContent(item.content);
    const previous = await this.repo.findIndexedDocument(item.title);
    const reusable = previous?.contentHash === knowledgeContentHash(item) &&
      previous.chunks.length === content.length && previous.chunks.every((chunk, index) =>
        chunk.content === content[index] && chunk.embeddingModel === knowledgeEmbeddingModel);
    const passages = reusable ? null : (await this.embed(content.map((part) => knowledgeEmbeddingText(item, part))))
      .vectors.map((embedding, index) => ({ content: content[index], embedding }));
    if (passages && passages.length !== content.length) throw new Error("Missing passage embeddings");
    const id = await this.repo.saveReviewedDocument(item, passages, expectedId);
    return { id, chunks: content.length, embedded: !reusable };
  }

  async checkSources(id?: string) {
    const results: Array<{ id: string; status: string; reviewOverdue: boolean }> = [];
    for (const item of await this.repo.listSourcesForCheck(id)) {
      let status = "UNAVAILABLE";
      try {
        const snapshot = await this.fetchSource(item.sourceUrl!);
        status = snapshot.sourceHash === item.sourceHash ? "UNCHANGED" : "CHANGED";
      } catch { /* Failed source checks must not renew or imply approval. */ }
      if (item.sourceHash) await this.repo.recordSourceCheck(item.id, item.sourceHash, status);
      results.push({ id: item.id, status, reviewOverdue: !item.reviewAfter || item.reviewAfter <= new Date() });
    }
    // FILE documents have no page to fetch, but their review dates still expire; report them without recording a check.
    if (!id) for (const item of await this.repo.listOverdueFileDocuments()) {
      results.push({ id: item.id, status: "UNCHANGED", reviewOverdue: true });
    }
    return results;
  }
}

export const knowledgeIngestionService = new KnowledgeIngestionService();
