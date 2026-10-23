# knowledge-rag-05: FAQ file import and action links

Type: feature
Status: in-progress (local implementation verified; database migration and import await user approval)
Updated: 2026-10-23
Blocked by: user go-ahead to migrate/import the connected database; the configured Supabase was unreachable ("tenant/user not found") and Docker was not running

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
  **Not done.**

## Verification

- `pnpm test:knowledge`: 39 tests (24 existing + 15 new); related admin/trace/Playground/report/
  concise-chat suites 65 tests passed; `pnpm typecheck`, `pnpm lint` passed; `graphify update .` AST refresh.
- `pnpm test:knowledge:db` was **not run**: the configured Supabase returned "tenant/user not found"
  and Docker is not running. Its new FILE-source assertions and the new migration are unexecuted.
- `.scratch/faq-import/manifest.json` (220 items, 72 with links, not committed) built with
  `pnpm knowledge:faq`. Every number in the PDF text appears in the source; pages 23 and 34 were
  compared with rendered images. 205 Q&As (not 195) plus 15 website-list entries.
- Link reachability **not checked**: this environment has no outbound network. `http://` links
  were upgraded to `https://`; `ursa2.bu.ac.th/withdrawal` and `commencement.bu.ac.th/fee|gownpickup`
  in particular may not serve HTTPS.
- Text repairs for dropped marks: lost sara am (`ส านัก` → `สำนัก`), `ซ้า`→`ซ้ำ`, `น้าตาล`/`น้าเงิน`→`น้ำ…`,
  `ดาวนโหลด`→`ดาวน์โหลด`. Keywords are auto-derived Latin terms (max 6).
- No real model/corpus UAT, no commit of imported content, no deployment.

## Comments

- 2026-10-23: Treated the PDF as BU-approved (`verifiedBy` names the file, review in six months);
  the user has not confirmed this. Allowlist for external action hosts is my call.
