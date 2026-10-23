# knowledge-rag-05: FAQ file import and action links

Type: feature
Status: resolved, 2026-10-24 (retrieval gaps from the first UAT fixed by keyword equivalents; see round 2)
Updated: 2026-10-24
Blocked by: none

## Scope

Import the BU FAQ PDF into the existing hybrid RAG as `FILE` items, and append the
transaction links each cited FAQ names. No crawler, LightRAG, RAG-Anything, new
service or admin UI. Plan: [2026-10-23-faq-file-import.md](../../../docs/superpowers/plans/2026-10-23-faq-file-import.md).

## Acceptance criteria

- `sourceKind` FILE items import without a page fetch, are skipped by `knowledge:check`
  and cannot be created, edited or source-checked through the admin page flow.
- `actionLinks` (max 5, HTTPS, allowlisted hosts) reach the answer only from cited evidence,
  de-duplicated, never on a miss; the model sees labels, never URLs.
- A manifest of 220 FAQ items builds from the PDF text and validates; manifest cap is 300.
- Migration applied, corpus imported and sample questions answered with the right steps and links.
  Done 2026-10-24, see UAT below.

## Verification

- `pnpm test:knowledge`: 45 knowledge tests (24 existing + 21 new); related admin/trace/Playground/
  suites 44 tests passed; `pnpm typecheck`, `pnpm lint` passed; `graphify update .` AST refresh.
- `pnpm test:knowledge:db` passed on 2026-10-23 against the reconnected Supabase using its isolated
  schema (public knowledge checksum unchanged): FILE retrieval with `actionLinks`, `listSourcesForCheck`
  omission, overdue FILE listing, PAGE hits returning `[]`, PAGE/FILE kind-change refusal, FILE counted as
  ready, plus all existing checks. The migration was applied only to that temporary schema.
- `.scratch/faq-import/manifest.json` (220 items, 72 with links, not committed) built with
  `pnpm knowledge:faq`. Every number in the PDF text appears in the source; pages 23 and 34 were
  compared with rendered images. 205 Q&As (not 195) plus 15 website-list entries.
- Link reachability **not checked**: this environment has no outbound network. `http://` links
  were upgraded to `https://`; `ursa2.bu.ac.th/withdrawal` and `commencement.bu.ac.th/fee|gownpickup`
  in particular may not serve HTTPS.
- Text repairs for dropped marks: lost sara am (`ส านัก` → `สำนัก`), `ซ้า`→`ซ้ำ`, `น้าตาล`/`น้าเงิน`→`น้ำ…`,
  `ดาวนโหลด`→`ดาวน์โหลด`. Keywords are auto-derived Latin terms (max 6).
- Edge cases fixed after review: admin panel shows FILE items as "ไฟล์ FAQ · ไม่มีการตรวจหน้าเว็บ" with edit/check
  disabled (verified by typecheck/lint only, no browser run); admin edits keep stored action links and ignore
  client-supplied ones; an import whose title belongs to a different source kind is refused before any write;
  the builder trims titles before its duplicate check and `knowledge:faq` caps its input at 3 MiB.
- No real model/corpus UAT, no commit of imported content, no deployment.

## Real-database rollout and UAT (2026-10-24)

- `pnpm db:migrate:deploy` applied two pending migrations to the connected Supabase: `20261023000000_student_accounts`
  (the OAuth table, approved by the user) and `20261023120000_knowledge_faq_file`. Before: 12 legacy PAGE items,
  0 chunks. After: 12 PAGE (unapproved, untouched) + 220 FILE (all approved, 72 with links, 220 chunks, one embedding
  model, content hashes consistent). `pnpm knowledge:import` embedded 220/220; a second run embedded 0/220;
  `pnpm knowledge:check` exited 0. Earliest FILE review date 2027-04-23.
- **Found by the UAT:** the answer call sent `temperature: 0.2`, which the default model `gpt-6-luna` rejects with
  HTTP 400, so every internal answer was a miss. Removed it (test added). `lib/ai.ts` ticket extraction,
  `lib/study-answer.ts` and `lib/study-extract.ts` also send a temperature; not tested here and probably affected.
- 10 real questions through `knowledgeService.answerQuestion` (real embedding, rewrite, rerank and answer calls, 6–7k
  tokens each): 7 answered with the right steps, fees and link block (transcript fees and steps, <1.75 GPA path,
  lost student card, installments, receipt, registrar contact, a follow-up "แล้วค่าธรรมเนียมเท่าไหร่" after a
  leave-of-absence turn rewritten correctly); 1 correct miss (campus restaurants are not in the corpus);
  **2 misses:** "ลืมรหัสผ่าน BU account" (the FAQ says "Password"; neither retrieval leg ranked it) and the English
  transcript question (Thai corpus; the fee item ranked first but the how-to item did not). A small Thai-synonym
  keyword map (รหัสผ่าน, ใบเกรด, ลดวิชา…) would likely fix the first; not applied because it needs a re-import.
- This is a ten-question sample, not a recall or accuracy measurement. Links were not opened (no network).
  Results are in `.scratch/faq-import/uat.json`, not committed.

### Round 2: Thai/English keyword equivalents (2026-10-24)

- Added 475 keywords across the 220 items (script `.scratch/faq-import/add-keywords.py`, uncommitted): Latin→Thai
  (Password→รหัสผ่าน/พาสเวิร์ด, Transcript→ใบเกรด/ทรานสคริป, Drop→ลดวิชา, Wi-Fi→ไวไฟ, Resume→เรซูเม่ …) and Thai→English
  (ค่าธรรมเนียม→fee, ลาพักการศึกษา→leave of absence, ใบเสร็จรับเงิน→receipt …). Keywords reach only the full-text leg:
  `knowledgeEmbeddingText` embeds title, category and passage, not keywords.
- Re-imported into the real database (same titles, newer approval): 220 items, 164 re-embedded, 56 reused, 220 chunks,
  keywords/links equal to the manifest for all 220, content hash and chunk hash consistent for all 220, 12 legacy PAGE
  items untouched, `knowledge:check` exit 0. Rollback: `.scratch/faq-import/manifest-v1.json` (previous keywords).
- Same 10 questions plus 3 variants: 12 of 13 answered with the right steps and link block; the one miss is the
  correct one (restaurants). Previously failing: "ลืมรหัสผ่าน BU account" now finds the Password FAQs and returns the
  three reset links; the English transcript question now returns steps, fees and the form link. Variants "ลืมพาสเวิร์ด…",
  "อยากได้ใบเกรด…" and "ลดวิชากับถอนวิชา…" all answered. In one of the 13 runs the reranker fell back to RRF order
  (provider variability); that answer was still correct. Still a 13-question sample, not a recall measurement.
  Results: `.scratch/faq-import/uat-2.json` (uncommitted).

## Comments

- 2026-10-23: Treated the PDF as BU-approved (`verifiedBy` names the file, review in six months);
  the user has not confirmed this. Allowlist for external action hosts is my call.
