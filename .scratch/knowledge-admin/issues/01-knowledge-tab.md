# knowledge-admin-01: Manage campus knowledge in the admin workspace

Type: feature
Status: resolved
Updated: 2026-10-13
Blocked by: none

## Scope

Implement [the spec](../spec.md). Preserve concurrent RAG/query-rewrite changes.

## Acceptance criteria

- Knowledge sidebar destination with authenticated list, search and pagination.
- View content, source/reviewer/dates, chunk count and RAG availability reason.
- Add/edit using reviewed ingestion; title collisions and changed identity cannot
  overwrite another document; failed preparation preserves previous evidence.
- Source snapshot preparation and individual checks use the existing safe fetcher.
- Cookie auth, same-origin writes, strict input validation and visible errors.
- Supplied reference layout: four corpus cards, server filters, 10/20/50-row table
  and General/Content/Chunks/Usage detail tabs with actual indexed passages.
- Focused regressions, typecheck/lint, browser responsive checks, docs and graph.

## Verification

- `pnpm exec tsx --test src/services/knowledge-admin.test.ts lib/knowledge-rag.test.ts src/services/admin-workspace.test.ts src/services/playground.test.ts src/services/bot-run-review.test.ts lib/concise-chat.test.ts`: 82 passed, including concurrent RAG telemetry regressions.
- `pnpm typecheck` and `pnpm lint`: passed.
- `pnpm test:knowledge:db`: passed in a random isolated schema. Asserted corpus
  totals, source/category/status filters before pagination, actual passage reads,
  stale/fingerprint eligibility, 120 legacy rows and existing rollback/ordering
  invariants. The schema was dropped and public knowledge checksum stayed equal.
- Actual Next routes at the existing local server: unauthenticated page redirects
  to login, list API returns 401 without a cookie, authenticated list reads 12
  stored articles, cross-origin writes return 403 and invalid input returns 400.
  These checks made no public knowledge writes or paid-provider calls.
- `output/playwright/knowledge-ui-check.js`: passed against real Next rendering,
  with mocked knowledge API reads/writes for interaction checks. Covered search,
  all filter controls, page/row-size changes, detail close/reopen, indexed chunks,
  tab Arrow/Home/End keys, source status refresh, failed snapshot/save/input
  retention, explicit retry, approval reset, unsaved-edit cancellation, correct
  UTC+7 dates and create/edit identity. Completion marker was verified true.
- Desktop 1536×1024, tablet 1024×768, mobile 390×844: no document horizontal
  overflow. Tables scroll inside the panel; mobile navigation and forms work.
  Screenshots were visually inspected: `output/playwright/knowledge-desktop.png`,
  `knowledge-mobile.png`, `knowledge-form-mobile.png`. Literal HTML and unsafe
  source links stayed inert; missing usage/processing/file facts are not invented.
- `graphify update .`: AST refresh passed, no LLM calls.

No owner-approved corpus import, real-provider save UAT, original PDF upload/
preview, production build, commit/push or deployment was performed. Reviewed
article saves remain operator assertions using the configured embedding provider.
Retrieval Playground reuses Web Chat/Execution Trace; per-document usage metrics
are not stored. Existing concurrent work was preserved.

## Comments

- 2026-10-13: Claimed after user confirmed list/search, add/edit and source checks.
  `jg` stalled without output and was stopped; targeted reads and Graphify query
  confirmed ingestion/repository ownership. Existing dirty work is preserved.
- 2026-10-13: User supplied the Knowledge Base reference during verification;
  table/filter/tab styling now follows it. PDF upload/preview and processing
  metrics remain outside the existing data contract; show actual article content.
- 2026-10-13: Resolved after the reference layout, management actions and scoped
  checks passed. Follow the RAG import guide when owner-reviewed content is ready.
