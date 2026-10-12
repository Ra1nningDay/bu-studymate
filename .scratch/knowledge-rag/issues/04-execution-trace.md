# knowledge-rag-04: Detailed RAG execution trace

Type: feature
Status: resolved
Updated: 2026-10-13
Blocked by: none for local implementation

## Scope

Expand only knowledge/RAG trace details in Web Chat: Query Rewrite, Hybrid
Retrieval, RRF Fusion, Reranker, LLM Generation and Output. Persist measured
durations, reported usage/model, rewritten query, candidate ranks and selected
passages in existing run JSON. Preserve chat layout and unrelated workflows.
RRF remains inside the retrieval SQL: show shared timing, never invented timing.
LLM reranker has no relevance score: show order changes, RRF and cosine labels.
No new model calls, schema migration or corpus import.

## Acceptance criteria

- Saved/reopened runs expose the actual query, candidates and selected passages
  in execution order, with expandable details and safe source links/text.
- Keyword/vector ranks and counts come from SQL; RRF/cosine values are labeled
  distinctly. Selected ranks reflect reranker/fallback output.
- Applied, skipped, fallback and failed generation are visible. Old runs with
  action/details only remain readable; invalid metadata does not break rendering.
- Web Chat and printable report preserve recorded trace detail, with mobile
  bounds/keyboard checks and no unrelated UI changes.
- Focused tests, SQL metadata check, typecheck/lint and AST refresh pass.

## Verification

- Combined router, concise-chat, knowledge, trace rendering, admin, Playground
  and report checks: 78 tests passed via `pnpm exec tsx --test` on the seven
  corresponding test files. Includes ordered stages, original/rewritten query,
  real SQL count/rank fields, selected rank eight → one, usage, fallback/skips,
  saved run JSON, optional metadata validation, old logs and safe report rendering.
- `pnpm test:knowledge:db`: passed on synthetic isolated Supabase schema.
  Keyword/vector ranks and disjoint Top 20 counts passed with existing filters,
  RRF and rollback checks. Schema cleanup completed; public checksum matched.
- Real Next Web Chat browser rendering at port 3000 with intercepted synthetic
  read APIs: desktop 1536×1024 and mobile 390×844 checks passed. No operational
  sends or real model calls. `output/playwright/rag-trace-check.js` checks stages,
  query/counts/ranks, chunk expansion, literal HTML, Sources/Raw tabs, keyboard,
  session reopening/fallback, legacy logs and horizontal bounds.
- Screenshots visually inspected: `output/playwright/rag-trace-sequence.png`,
  `rag-trace-overview.png`, `rag-trace-desktop.png`, `rag-trace-mobile.png`.
  Synthetic fixture timings/sources are UI test data, not model performance.
- `pnpm typecheck`, `pnpm lint`, `git diff --check`: passed. Initial typecheck
  errors in concurrently edited Knowledge Admin files resolved through that
  task's updates; this task did not edit those files.
- `graphify update .`: AST refresh passed without model calls; documentation
  semantic extraction was not performed. Existing favicon 404 was observed
  in the browser console, with no trace-specific browser exception.
- No approved-corpus/model quality benchmark, live model/LINE UAT, schema
  migration, commit/push or deployment. Detailed snapshots apply to new runs;
  old records keep only previously captured data.

## Comments

- 2026-10-13: Claimed after the user said “ทำเลย” on the detailed trace proposal.
  Concurrent knowledge-admin files are present and will be preserved.
- 2026-10-13: Resolved after local checks. Only knowledge/RAG telemetry and its
  existing Chat/report rendering changed. RRF remains in SQL, elapsed retrieval
  includes embedding/SQL, Output measures formatting, and rerank has ranks rather
  than invented scores. Next action remains real corpus/provider verification.
