import { z } from "zod";
import { env } from "@/src/config/env";

export const knowledgeEmbeddingModel = "text-embedding-3-small";
export const knowledgeEmbeddingDimensions = 1536;
export const knowledgeVectorSchema = z.array(z.number().finite()).length(knowledgeEmbeddingDimensions)
  .refine((values) => values.some((value) => value !== 0), "Embedding must be nonzero");

export async function embedKnowledge(input: string[]) {
  if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required for knowledge embeddings");
  if (!input.length || input.length > 32 || input.some((text) => !text.trim() || Buffer.byteLength(text, "utf8") > 7500)) {
    throw new Error("Embedding input must contain 1-32 nonempty passages of at most 7500 UTF-8 bytes each");
  }
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: knowledgeEmbeddingModel, input,
      dimensions: knowledgeEmbeddingDimensions, encoding_format: "float" }),
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`Knowledge embedding request failed (${response.status})`);
  const result = z.object({
    model: z.literal(knowledgeEmbeddingModel),
    data: z.array(z.object({ index: z.number().int().nonnegative(), embedding: knowledgeVectorSchema })),
    usage: z.object({ total_tokens: z.number().int().nonnegative() })
  }).parse(await response.json());
  const ordered = result.data.sort((a, b) => a.index - b.index);
  if (ordered.length !== input.length || ordered.some((item, index) => item.index !== index)) {
    throw new Error("Embedding response indices do not match the request");
  }
  return { vectors: ordered.map((item) => item.embedding), usage: result.usage, model: result.model };
}
