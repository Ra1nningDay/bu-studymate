import { KnowledgeDocumentSchema, KnowledgeManifestSchema, type ActionLink, type KnowledgeDocument } from "@/src/dtos/knowledge.dto";

export type FaqEntry = { title: string; category: string; content: string; keywords?: string[]; actionLinks?: ActionLink[] };

const faqSourceUrl = "https://faq.bu.ac.th/wordpress/";
const faqReviewMonths = 6;

export function buildFaqManifest(entries: FaqEntry[], file: { name: string; sha256: string }, now: Date): KnowledgeDocument[] {
  const reviewAfter = new Date(now);
  reviewAfter.setUTCMonth(reviewAfter.getUTCMonth() + faqReviewMonths);
  const titles = new Set<string>();
  const documents = entries.map((entry) => {
    if (titles.has(entry.title)) throw new Error(`Duplicate FAQ title: ${entry.title}`);
    titles.add(entry.title);
    // Links belong in actionLinks; a URL in content would make the answer generator reject its own answer.
    if (/https?:\/\/|www\./i.test(entry.content)) throw new Error(`FAQ content must not contain URLs: ${entry.title}`);
    const document = { ...entry, sourceKind: "FILE", sourceUrl: faqSourceUrl,
      sourceHash: file.sha256, verifiedBy: `BU FAQ file: ${file.name}`, verifiedAt: now.toISOString(),
      reviewAfter: reviewAfter.toISOString() };
    const parsed = KnowledgeDocumentSchema.safeParse(document);
    if (!parsed.success) throw new Error(`Invalid FAQ entry ${entry.title}: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`);
    return document;
  });
  return KnowledgeManifestSchema.parse(documents);
}
