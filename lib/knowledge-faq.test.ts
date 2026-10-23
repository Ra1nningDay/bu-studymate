import assert from "node:assert/strict";
import { test } from "node:test";
import { KnowledgeDocumentSchema, KnowledgeManifestSchema, knowledgeActionLinkSchema } from "@/src/dtos/knowledge.dto";

const reviewed = {
  title: "Synthetic Registrar", category: "Synthetic test", content: "ขอเอกสารผ่านระบบทดสอบ",
  keywords: ["เอกสาร", "IT232"], sourceUrl: "https://bu.ac.th/synthetic-test",
  sourceHash: "a".repeat(64), verifiedBy: "Synthetic fixture only",
  verifiedAt: "2026-10-12T00:00:00Z", reviewAfter: "2099-01-01T00:00:00Z"
};
const link = (url: string, label = "ลิงก์ทดสอบ") => knowledgeActionLinkSchema.safeParse({ label, url });

test("action links accept bu.ac.th, subdomains and the two allowed external hosts", () => {
  for (const url of [
    "https://bulinks.bu.ac.th/service-petition-new/", "https://bu.ac.th/",
    "https://th-th.facebook.com/scholarship.bu/", "https://login.microsoftonline.com/"
  ]) assert.equal(link(url).success, true, url);
});

test("action links reject hostile URLs, empty labels and overlong labels", () => {
  for (const url of [
    "http://bu.ac.th/", "javascript:alert(1)", "https://user:pw@bu.ac.th/",
    "https://bu.ac.th.evil.com/", "https://evilfacebook.com/", "https://bu.ac.th:8443/",
    "https://bu.ac.th/#frag"
  ]) assert.equal(link(url).success, false, url);
  assert.equal(link("https://bu.ac.th/", "").success, false);
  assert.equal(link("https://bu.ac.th/", "x".repeat(101)).success, false);
});

test("document defaults to PAGE with no action links; more than 5 links rejected", () => {
  const parsed = KnowledgeDocumentSchema.parse(reviewed);
  assert.equal(parsed.sourceKind, "PAGE");
  assert.deepEqual(parsed.actionLinks, []);
  const links = Array.from({ length: 6 }, (_, index) => ({ label: `l${index}`, url: `https://bu.ac.th/${index}` }));
  assert.equal(KnowledgeDocumentSchema.safeParse({ ...reviewed, actionLinks: links }).success, false);
  assert.equal(KnowledgeDocumentSchema.safeParse({ ...reviewed, actionLinks: links.slice(0, 5) }).success, true);
});

test("manifest accepts 195 unique documents and rejects 301", () => {
  const many = (count: number) => Array.from({ length: count }, (_, index) => ({ ...reviewed, title: `t${index}` }));
  assert.equal(KnowledgeManifestSchema.safeParse(many(195)).success, true);
  assert.equal(KnowledgeManifestSchema.safeParse(many(301)).success, false);
});
