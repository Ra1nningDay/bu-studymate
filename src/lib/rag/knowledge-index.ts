import { createHash } from "node:crypto";
import type { KnowledgeDocument } from "@/src/dtos/knowledge.dto";

const words = new Intl.Segmenter("th", { granularity: "word" });
const sentences = new Intl.Segmenter("th", { granularity: "sentence" });

export function tokenizeKnowledge(text: string) {
  return Array.from(words.segment(text.normalize("NFKC").toLowerCase()))
    .filter((part) => part.isWordLike).map((part) => part.segment).join(" ");
}

export function knowledgeContentHash(item: Pick<KnowledgeDocument, "title" | "category" | "keywords" | "content" | "sourceUrl">) {
  return createHash("md5").update([
    item.title, item.category, item.keywords.join("\n"), item.content, item.sourceUrl
  ].join("\n")).digest("hex");
}

export function splitKnowledgeContent(content: string) {
  const chunks: string[] = [];
  let current = "";
  for (const { segment } of sentences.segment(content)) {
    const characters = Array.from(segment);
    for (let offset = 0; offset < characters.length; offset += 1200) {
      const part = characters.slice(offset, offset + 1200).join("");
      if (Array.from(current + part).length > 1200) {
        if (current.trim()) chunks.push(current.trim());
        current = "";
      }
      current += part;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export function knowledgeEmbeddingText(item: Pick<KnowledgeDocument, "title" | "category">, content: string) {
  return `${item.title}\n${item.category}\n${content}`;
}
