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
const KnowledgeSelectionSchema = z.array(z.object({ id: KnowledgeIdSchema, updatedAt: z.iso.datetime({ offset: true }) }).strict())
  .min(1).max(50).refine((items) => new Set(items.map((item) => item.id)).size === items.length, "Select distinct articles");
export const KnowledgeBulkSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("delete"), selection: KnowledgeSelectionSchema }).strict(),
  z.object({ action: z.literal("update"), selection: KnowledgeSelectionSchema,
    changes: z.object({ category: z.string().trim().min(1).max(100).optional(),
      keywords: z.array(z.string().trim().min(1).max(50)).max(30).optional()
    }).strict().refine((changes) => changes.category !== undefined || changes.keywords !== undefined, "Choose a field to update")
  }).strict()
]);
export type KnowledgeSave = z.infer<typeof KnowledgeSaveSchema>;
export type KnowledgeBulk = z.infer<typeof KnowledgeBulkSchema>;
export type KnowledgeSelection = KnowledgeBulk["selection"];
export type KnowledgeFilters = Pick<z.infer<typeof KnowledgeListSchema>, "category" | "status" | "source" | "limit">;
