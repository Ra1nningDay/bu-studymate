# FAQ File Import + Action Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import all 195 Q&As from `FAQ x Website links.pdf` into the existing hybrid RAG, and have the bot append the transaction links ("action links") for the FAQ it answered from.

**Architecture:** No new RAG engine. FAQ items become `KnowledgeItem`s with a new `sourceKind = "FILE"` (no page fetch, no hash re-check, never marked CHANGED) and a new `actionLinks` JSON column. Retrieval SQL, eligibility rules and the official-URL gates stay untouched because every FILE item still carries an official `sourceUrl` and a 64-hex `sourceHash` (SHA-256 of the PDF). The answer path appends a "ลิงก์สำหรับทำรายการ" block built by the server from the evidence the LLM actually cited.

**Tech Stack:** Next.js 15, Prisma + Supabase PostgreSQL/pgvector, Zod, `node:test` via `tsx --test`, `pnpm`.

**Spec:** No separate spec file. Decisions are the "Decisions" section below (agreed in conversation 2026-10-23); background in [.scratch/knowledge-rag/spec.md](../../../.scratch/knowledge-rag/spec.md) and [docs/knowledge-rag.md](../../knowledge-rag.md).

## Decisions

Agreed with the user:
- Import **all 195** FAQ items; links in the FAQ are *transaction links* the bot hands to students, not pages to crawl. No crawler, LightRAG or RAG-Anything in this work.
- Action links are separate from citation sources and are not hash-checked.

My calls (the user has not confirmed these; flag them in the final report):
- The PDF is treated as BU-approved content. `verifiedBy = "BU FAQ file: FAQ x Website links.pdf"`, `reviewAfter = verifiedAt + 6 months`. Nobody reviews each of the 195 items before import.
- Citation `sourceUrl` for every FILE item is `https://faq.bu.ac.th/wordpress/` (the only FAQ home URL in the PDF).
- Non-`bu.ac.th` action-link hosts allowed: exactly `th-th.facebook.com` and `login.microsoftonline.com` (both appear in the PDF). Anything else is rejected.
- Manifest cap rises from 100 to 300 items.
- Admin-form editing of FILE items is refused; edit by re-importing.

Out of scope: crawling/extracting linked pages, PDF OCR inside the app, admin UI for action links, link health checks.

## Global Constraints

- Layering per [AGENTS.md](../../../AGENTS.md): no `prisma` import outside `src/repositories/`; no chat templates in services (use `src/presenters/`); no `process.env` in app logic.
- `sourceKind` values are exactly `"PAGE"` (default) and `"FILE"`. Existing rows and existing manifests behave exactly as before.
- `actionLinks`: at most 5 per item; each `{ label: string 1..100 chars, url: string }`; `https:` only, no credentials, no port, no fragment.
- Transcribed FAQ `content` must contain no `http://`, `https://` or `www.` text (the answer generator rejects any answer containing a URL; links live only in `actionLinks`).
- `contentHash` (and the SQL `md5(...)` that recomputes it) must NOT change: do not add `actionLinks` or `sourceKind` to `knowledgeContentHash`.
- Work on a new branch from `master` (`feat/faq-file-import`); the current branch holds unrelated student-login work.
- Applying the migration to, and importing into, the connected Supabase database is a shared-data action: ask the user before running Task 6 steps that touch it.
- Before finishing: `pnpm typecheck`, `pnpm lint`, `pnpm test:knowledge`, `pnpm test:knowledge:db`, then `graphify update .`. Conventional Commits; never commit secrets.

## Review Focus

- FILE item import and `pnpm knowledge:check` never touch the network, and a corpus of only FILE items exits 0 (Task 2).
- Hostile action links: `http://`, `javascript:`, `https://user:pw@bu.ac.th/`, `https://bu.ac.th.evil.com/`, `https://evilfacebook.com/`, a 6th link, empty label (Task 1).
- 195 items accepted, 301 rejected, duplicate titles rejected, content containing a URL rejected (Tasks 1, 4).
- Links shown only for evidence the LLM cited, deduplicated, none on a miss, none when evidence has no links (Task 3).
- Admin API cannot create/edit/check a FILE item through the page-snapshot flow (Task 2).
- Legacy PAGE documents and all existing tests behave unchanged (every task runs the existing suite).

---

### Task 1: Schema, migration and DTO

**Files:**
- Modify: `prisma/schema.prisma` (model `KnowledgeItem`), `src/dtos/knowledge.dto.ts`, `package.json` (script `test:knowledge`)
- Create: `prisma/migrations/20261023120000_knowledge_faq_file/migration.sql`, `lib/knowledge-faq.test.ts`

**Interfaces:**
- Produces (`src/dtos/knowledge.dto.ts`):
  - `knowledgeActionLinkSchema` (Zod) and `type ActionLink = { label: string; url: string }`
  - `KnowledgeDocumentSchema` gains `sourceKind: "PAGE" | "FILE"` (default `"PAGE"`) and `actionLinks: ActionLink[]` (default `[]`, max 5)
  - `KnowledgeManifestSchema` max 300
- Produces (DB): `knowledge_items.source_kind TEXT NOT NULL DEFAULT 'PAGE'`, `knowledge_items.action_links JSONB NOT NULL DEFAULT '[]'`; Prisma fields `sourceKind String @default("PAGE") @map("source_kind")`, `actionLinks Json @default("[]") @map("action_links")`.

- [ ] **Step 1: Write failing tests in `lib/knowledge-faq.test.ts`** (`node:test` + `assert/strict`, same imports style as `lib/knowledge-rag.test.ts`). Reuse that file's `reviewed` fixture shape (copy the object, do not import it).
  - `"action links accept bu.ac.th, subdomains and the two allowed external hosts"`: parse `https://bulinks.bu.ac.th/service-petition-new/`, `https://bu.ac.th/`, `https://th-th.facebook.com/scholarship.bu/`, `https://login.microsoftonline.com/` → all succeed.
  - `"action links reject hostile URLs"`: each of the Review Focus URLs fails `knowledgeActionLinkSchema.safeParse({ label: "x", url })`; empty label fails; label of 101 chars fails.
  - `"document defaults to PAGE with no action links; more than 5 links rejected"`: `KnowledgeDocumentSchema.parse(reviewed)` has `sourceKind === "PAGE"` and `actionLinks` deep-equal `[]`; six links → `success === false`.
  - `"manifest accepts 195 unique documents and rejects 301"`: build arrays from `reviewed` with titles `t0..tN`.
- [ ] **Step 2:** Run `pnpm exec tsx --test lib/knowledge-faq.test.ts`. Expected: FAIL (`knowledgeActionLinkSchema` undefined).
- [ ] **Step 3: Implement** in `src/dtos/knowledge.dto.ts`: `knowledgeActionLinkSchema` = `{ label: z.string().trim().min(1).max(100), url: z.string().url() }` refined so the URL is `https:`, has no username/password/port/hash, and its hostname is `bu.ac.th`, ends `.bu.ac.th`, or is exactly one of a module constant `externalActionHosts = ["th-th.facebook.com", "login.microsoftonline.com"]`. Add the two document fields and raise the manifest cap. Add the two columns to `schema.prisma` and write the migration as two `ALTER TABLE "knowledge_items" ADD COLUMN ...` statements (same style as `20261013000000_hybrid_knowledge`).
- [ ] **Step 4:** Add `lib/knowledge-faq.test.ts` to the `test:knowledge` script. Run `pnpm db:generate` (stop any running dev server first on Windows), `pnpm test:knowledge`, `pnpm typecheck`. Expected: new tests PASS; fix compile errors that appear where `KnowledgeDocument` objects are built (admin DTO/tests) by supplying the new defaulted fields, without changing behavior.
- [ ] **Step 5: Commit** `feat(knowledge): add FILE source kind and action link schema`

### Task 2: FILE items skip page verification

**Files:**
- Modify: `src/services/knowledge-ingestion.service.ts`, `src/repositories/knowledge.repository.ts` (`listSourcesForCheck`), `src/services/knowledge-admin.service.ts` (`save`, `check`), `scripts/check-knowledge-db.ts`
- Test: `lib/knowledge-faq.test.ts`, `src/services/knowledge-admin.test.ts`

**Interfaces:**
- Consumes: `KnowledgeDocument.sourceKind` from Task 1.
- Produces: `importReviewedDocument` no longer calls `fetchSource` when `item.sourceKind === "FILE"`; `listSourcesForCheck` returns only `sourceKind: "PAGE"` rows; `KnowledgeAdminService.save` throws `KnowledgeAdminError(…, 400)` when `document.sourceKind !== "PAGE"` and `KnowledgeAdminError(…, 409)` when the existing row (by `id`) is FILE; `check` throws `KnowledgeAdminError(…, 400)` for a FILE row.

- [ ] **Step 1: Write failing tests.**
  - In `lib/knowledge-faq.test.ts`, reuse the fake-repo/fake-embed pattern of the test `"unchanged import reuses embeddings; approval cannot be renewed by a failed source check"` in `lib/knowledge-rag.test.ts`: `"FILE import never fetches the source"` passes a `fetchSource` that throws and asserts `importReviewedDocument({ ...reviewed, sourceKind: "FILE" })` resolves with `embedded: true`; `"PAGE import still fails when the source hash differs"` asserts the existing `Source changed since review` error.
  - In `src/services/knowledge-admin.test.ts` (follow its fake-repo style): `"admin save refuses sourceKind FILE"` (400), `"admin save refuses to edit an existing FILE item"` (409), `"admin check refuses FILE items"` (400).
- [ ] **Step 2:** Run both test files. Expected: FAIL.
- [ ] **Step 3: Implement.** In `importReviewedDocument` wrap the snapshot fetch and hash comparison in `if (item.sourceKind === "PAGE")`. Add `sourceKind: "PAGE"` to the `where` of `listSourcesForCheck`. Add the three guards in `KnowledgeAdminService` (Thai messages in the style of the existing ones). In `scripts/check-knowledge-db.ts` also read and apply the new migration file after the hybrid migration (same `replace(/^--.*$/gm, "").split(";")` loop), and add two assertions to that script: a FILE item with no network is retrievable via `hybridSearch`, and `listSourcesForCheck()` omits it.
- [ ] **Step 4:** Run `pnpm test:knowledge`, `pnpm exec tsx --test src/services/knowledge-admin.test.ts`, `pnpm test:knowledge:db`, `pnpm typecheck`. Expected: PASS (DB check needs a role that can create/drop its isolated schema; if unreachable, record that in the ticket).
- [ ] **Step 5: Commit** `feat(knowledge): let FILE sources skip page verification`

### Task 3: Action links in answers

**Files:**
- Modify: `src/repositories/knowledge.repository.ts` (`KnowledgeEvidence`, `hybridSearch`), `lib/ai.ts` (`rewriteKnowledgeAnswer`), `src/services/knowledge.service.ts` (`answerQuestion`)
- Create: `src/presenters/knowledge-answer.presenter.ts`
- Test: `lib/knowledge-faq.test.ts`

**Interfaces:**
- Consumes: `ActionLink` (Task 1).
- Produces:
  - `KnowledgeEvidence.actionLinks?: ActionLink[]`; `hybridSearch` selects `k.action_links` in the `eligible` CTE and returns it as `"actionLinks"`.
  - `rewriteKnowledgeAnswer` has an explicit return type `Promise<KnowledgeAnswerResult>` where `actionLinks?: ActionLink[]` is optional (so existing test fakes still type-check). On success it returns the de-duplicated (by URL), max-5 links of the evidence whose IDs the model cited; on every miss path `[]`.
  - `appendActionLinks(text: string, links: ActionLink[]): string` — returns `text` unchanged when `links` is empty, else `${text}\n\nลิงก์สำหรับทำรายการ:\n` + one `- ${label}: ${url}` line per link.
  - `KnowledgeService.answerQuestion` non-miss text = `appendActionLinks(result.text, result.actionLinks ?? [])`.

- [ ] **Step 1: Write failing tests** following the fake-`fetch` pattern of `"answer cites only selected retrieved IDs and rejects invented citations or raw URLs"`:
  - `"answer appends links only for cited evidence, de-duplicated"`: two evidence items, the model cites only the second; the first has link A, the second has links B and B again. Expect `text` ends with a block containing B once and not A.
  - `"no link block when cited evidence has no links, and none on a miss"`.
  - `"evidence payload sent to the model lists link labels but no URLs"`: inspect the captured request body; it contains the labels and does not contain the link URL.
  - `appendActionLinks` unit test with exact expected string for two links.
- [ ] **Step 2:** Run `pnpm exec tsx --test lib/knowledge-faq.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** In `rewriteKnowledgeAnswer`: add `actionLinks: (item.actionLinks ?? []).map((link) => link.label)` to each evidence entry in the user payload, and one sentence to the system prompt: when an evidence item lists `actionLinks`, tell the student to use that labeled link; the system appends the URLs, never write them. Build the returned links from the cited evidence after the existing citation validation. Keep the existing rule that an answer containing a URL is a miss.
- [ ] **Step 4:** Run `pnpm test:knowledge` (all existing tests must still pass) and `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(knowledge): append action links to cited FAQ answers`

### Task 4: FAQ manifest builder

**Files:**
- Create: `lib/knowledge-faq.ts`
- Modify: `scripts/knowledge.ts` (new command `faq`), `package.json` (script `knowledge:faq`)
- Test: `lib/knowledge-faq.test.ts`

**Interfaces:**
- Produces: `type FaqEntry = { title: string; category: string; content: string; keywords?: string[]; actionLinks?: ActionLink[] }` and
  `buildFaqManifest(entries: FaqEntry[], file: { name: string; sha256: string }, now: Date): KnowledgeDocument[]` in `lib/knowledge-faq.ts`.
  Output items have `sourceKind: "FILE"`, `sourceUrl: "https://faq.bu.ac.th/wordpress/"`, `sourceHash: file.sha256`, `verifiedBy: "BU FAQ file: " + file.name`, `verifiedAt: now`, `reviewAfter: now + 6 calendar months`. The result passes `KnowledgeManifestSchema.parse` (as ISO strings in the CLI output).
- CLI: `pnpm knowledge:faq <faq-source.json> <faq.pdf>` prints the manifest JSON (hash computed from the PDF bytes with `node:crypto`).

- [ ] **Step 1: Write failing tests.** `"builder fills FILE metadata and 6-month review"` (exact dates from a fixed `now`); `"builder throws on duplicate titles, naming the title"`; `"builder throws when content contains http://, https:// or www."`; `"builder output round-trips through KnowledgeManifestSchema"`.
- [ ] **Step 2:** Run the test file. Expected: FAIL.
- [ ] **Step 3: Implement** `buildFaqManifest` (validation errors name the offending title) and the `faq` command in `scripts/knowledge.ts` following that file's existing structure (read source JSON, 3 MiB cap, hash the PDF, print JSON).
- [ ] **Step 4:** `pnpm test:knowledge`, `pnpm typecheck`, `pnpm lint`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(knowledge): build FAQ file manifests`

### Task 5: Transcribe the PDF (content, not code)

**Files:**
- Create: `.scratch/faq-import/faq-source.json` (array of `FaqEntry`), `.scratch/faq-import/manifest.json` (generated). Do not commit these until the user has looked at them.

The PDF's Thai text layer is empty (only digits, emails and URLs extract), so the pages must be read as images.

- [ ] **Step 1:** Render pages to PNG in the scratchpad directory: `scoop install poppler` (if `pdftoppm` is missing) then `pdftoppm -r 110 -png "C:\Users\tkham\Downloads\FAQ x Website links.pdf" <scratch>/page`. Alternative: open the PDF in the built-in browser and capture pages. Read the PNGs with the Read tool, a few pages at a time.
- [ ] **Step 2:** Transcribe every Q&A into `faq-source.json`: `title` = the question; `category` = the topic heading used in the PDF (fall back to the owning unit); `content` = the answer as plain chat-ready text with steps, fees, contact and hours, **URLs removed**; `actionLinks` = each URL in that answer with a short Thai label taken from the step it belongs to (e.g. "ยื่นคำร้องออนไลน์"); `keywords` = 3–8 Thai/English search words including common student phrasing. Titles must be unique: if two questions repeat, add the distinguishing context to the title.
- [ ] **Step 3:** Check counts and URLs: `faq-source.json` has exactly the number of `Q:` lines in the text layer (`pdftotext` output: 195); every URL in `pdftotext` output appears as an `actionLinks.url` at least once (truncated URLs in the text layer — `bulinks.bu.ac.th/service-` and similar — must be completed from the image).
- [ ] **Step 4:** Run `pnpm knowledge:faq .scratch/faq-import/faq-source.json "C:\Users\tkham\Downloads\FAQ x Website links.pdf" > .scratch/faq-import/manifest.json`. Expected: exit 0; any thrown error names the item to fix.
- [ ] **Step 5:** Spot-check 20 evenly spaced items against the page images (fees, hours, emails, link targets) and fix mismatches. Report the sample result and any item you could not read confidently; ask the user to review those before Task 6.

### Task 6: Import, verify, document (needs user go-ahead for DB steps)

**Files:**
- Modify: `docs/knowledge-rag.md`, `.scratch/knowledge-rag/spec.md`, `.scratch/README.md`, `ARCHITECTURE.md` (only if it describes ingestion/eligibility), `.env.example` (no change expected)
- Create: `.scratch/knowledge-rag/issues/05-faq-file-import.md` (ticket in the format of `04-execution-trace.md`)

- [ ] **Step 1: Ask the user** to approve running against the connected database: (a) `pnpm db:migrate:deploy` (additive: two columns), (b) `pnpm knowledge:import .scratch/faq-import/manifest.json`. Do not proceed without a yes.
- [ ] **Step 2:** After approval run (a), then (b). Expected: JSON result with 195 entries, each `chunks >= 1`, `embedded: true`. A re-run must print `embedded: false` for all.
- [ ] **Step 3:** Run `pnpm knowledge:check`. Expected: exit 0 and no FILE item listed. In `/admin/knowledge` confirm the 195 items show as ready.
- [ ] **Step 4:** In the admin Playground ask 10 real student questions covering: transcript request, tuition installment, GPA below 1.75 petition, ID card, a no-link FAQ, an English question, and a follow-up. Record, per question, whether the answer has the right steps, the right link block and no invented URL. Quality of retrieval at this size is unmeasured; record the result as a sample, not as accuracy.
- [ ] **Step 5:** Update `docs/knowledge-rag.md` (FILE source kind, action links, 300 cap, admin refusal, the PDF-as-approved assumption), `spec.md` (new follow-up paragraph), the ticket (checks run, limits, "no crawler"), and the `.scratch/README.md` row/handoff. Run `pnpm typecheck`, `pnpm lint`, `pnpm test:knowledge`, `graphify update .`.
- [ ] **Step 6: Commit** `docs(knowledge): record FAQ file import` (and, once the user has reviewed `.scratch/faq-import/`, `feat(knowledge): import FAQ file corpus`).
