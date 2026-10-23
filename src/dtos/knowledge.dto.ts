import { z } from "zod";

export const officialKnowledgeUrlSchema = z.string().url().refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password &&
    !url.port && !url.hash &&
    (url.hostname === "bu.ac.th" || url.hostname.endsWith(".bu.ac.th"));
}, "Use an HTTPS Bangkok University source URL without credentials, port or fragment");

const externalActionHosts = ["th-th.facebook.com", "login.microsoftonline.com", "line.me", "www.youtube.com"];

export const knowledgeActionLinkSchema = z.object({
  label: z.string().trim().min(1).max(100),
  url: z.string().url().refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port && !url.hash &&
      (url.hostname === "bu.ac.th" || url.hostname.endsWith(".bu.ac.th") || externalActionHosts.includes(url.hostname));
  }, "Use an HTTPS Bangkok University or approved external URL without credentials, port or fragment")
}).strict();

export type ActionLink = z.infer<typeof knowledgeActionLinkSchema>;

export const KnowledgeDocumentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(100),
  content: z.string().trim().min(1).max(20000),
  keywords: z.array(z.string().trim().min(1).max(50)).max(30).default([]),
  sourceUrl: officialKnowledgeUrlSchema,
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
  sourceKind: z.enum(["PAGE", "FILE"]).default("PAGE"),
  actionLinks: z.array(knowledgeActionLinkSchema).max(5).default([]),
  verifiedBy: z.string().trim().min(1).max(200),
  verifiedAt: z.iso.datetime({ offset: true }).transform((value) => new Date(value)),
  reviewAfter: z.iso.datetime({ offset: true }).transform((value) => new Date(value)),
  validFrom: z.iso.datetime({ offset: true }).transform((value) => new Date(value)).optional(),
  validUntil: z.iso.datetime({ offset: true }).transform((value) => new Date(value)).optional()
}).strict().refine((item) => item.reviewAfter > item.verifiedAt, "Review date must follow verification")
  .refine((item) => !item.validUntil || item.validUntil > (item.validFrom ?? item.verifiedAt),
    "Validity end must follow validity start");

export const KnowledgeManifestSchema = z.array(KnowledgeDocumentSchema).min(1).max(300)
  .refine((items) => new Set(items.map((item) => item.title)).size === items.length,
    "Document titles must be unique within the manifest");

export type KnowledgeDocument = z.infer<typeof KnowledgeDocumentSchema>;
