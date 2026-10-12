import { z } from "zod";
import { KnowledgeDocumentSchema, officialKnowledgeUrlSchema } from "./knowledge.dto";

export const KnowledgeIdSchema = z.uuid();
export const KnowledgeListSchema = z.object({
  search: z.string().trim().max(200).default(""),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  category: z.string().trim().max(100).default(""),
  status: z.enum(["all", "ready", "unapproved", "review"]).default("all"),
  source: z.enum(["all", "official", "legacy", "missing"]).default("all"),
  limit: z.coerce.number().pipe(z.union([z.literal(10), z.literal(20), z.literal(50)])).default(10)
}).strict();
export const KnowledgeSaveSchema = z.object({
  id: KnowledgeIdSchema.optional(), document: KnowledgeDocumentSchema
}).strict();
export const KnowledgeSourceSchema = z.object({ sourceUrl: officialKnowledgeUrlSchema }).strict();
export type KnowledgeSave = z.infer<typeof KnowledgeSaveSchema>;
export type KnowledgeFilters = Pick<z.infer<typeof KnowledgeListSchema>, "category" | "status" | "source" | "limit">;
