import { z } from "zod";

export const officialKnowledgeUrlSchema = z.string().url().refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password &&
    !url.port && !url.hash &&
    (url.hostname === "bu.ac.th" || url.hostname.endsWith(".bu.ac.th"));
}, "Use an HTTPS Bangkok University source URL without credentials, port or fragment");

const externalActionHosts = ["th-th.facebook.com", "login.microsoftonline.com", "line.me", "www.youtube.com"];

export const knowledgeActionLinkSchema = z.object({
  // Labels and URLs are rendered verbatim into chat text, so no extra URL or line break may hide in either.
  label: z.string().trim().min(1).max(100).refine((value) => !/https?:|www\.|[\r\n\t]/i.test(value), "Labels must not contain URLs or line breaks"),
  url: z.string().url().refine((value) => {
    if (!/^[\x21-\x7e]+$/.test(value)) return false;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password && !url.port && !url.hash &&
        (url.hostname === "bu.ac.th" || url.hostname.endsWith(".bu.ac.th") || externalActionHosts.includes(url.hostname));
    } catch { return false; }
  }, "Use an HTTPS Bangkok University or approved external URL without whitespace, credentials, port or fragment")
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
