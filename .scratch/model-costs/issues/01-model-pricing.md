# model-costs-01: Model rates and usage calculation

Type: enhancement
Status: resolved
Updated: 2026-10-31
Blocked by: none

## Scope

Add Luna/Jev rates, preserve per-call usage and provider cost, count observed search
calls, and display rates/cost coverage in the existing Cost page. Historical
complete token splits may be estimated at displayed current rates; incomplete
records stay unpriced. Preserve unrelated benchmark/audit work.

## Acceptance Criteria

- [x] Supported model prices match the cited Standard rates; unknown models have no fallback price.
- [x] Router (including observed shadow/fallback), RAG and search preserve model/provider/step and token splits.
- [x] Provider cost and observed search fees are retained without counting tokens twice.
- [x] Complete historical splits can be estimated without trusting old fallback costs; incomplete data stays explicit.
- [x] Cost displays model rates and distinguishes missing rates from missing usage detail.
- [x] Focused regressions, typecheck, lint, graph and responsive checks recorded.

## Verification

- Red check: all three initial pricing regressions failed against the original
  fallback implementation (Luna rate, Jev build rate, unknown/incomplete usage).
- Final focused offline suite: 110/110 passed. Includes pricing, repository,
  AnalyticsCostService, real adapter/workflow flow with intercepted fetch and fake
  storage, Jev routing/shadow/fallback, RAG/FAQ, chat latency/SSE, concise-chat,
  extracted chat workflows and OpenAI parameter regressions. Full command/result:
  `tests.log` in this effort. No paid API calls.
- `pnpm typecheck`, `pnpm lint`, scoped `git diff --check`: passed after concurrent
  chat-module moves settled. A mid-move run failed on missing old imports; the
  final checks use current `src/services/chat/` paths and pass.
- `pnpm exec tsx .scratch/model-costs/check-db.ts`: passed all three SELECT-only
  PostgreSQL CTE fixtures (absent log table, old schema, migrated-shaped schema).
  Covers overlap/residual legacy totals, day bounds, unlinked usage, ignoring old
  fallback money, provider cost and observed zero-token tool calls without double
  charges. Fixtures do not insert rows or change tables.
- Prisma schema validation passed. Client generation passed in isolated
  `.promptfoo/model-cost-prisma/client`; root `pnpm db:generate` encountered a
  Windows held-DLL rename (EPERM), so no processes were stopped. Generated root
  types contain the new fields and final compilation/tests pass.
- Isolated production Next build of real Cost page/service/shell with fake auth
  and repository passed: `node output/playwright/model-costs/setup.cjs`, then
  `pnpm exec next build .promptfoo/model-cost-preview` (no migration build hook).
- Playwright actual Chromium checks passed at 1440/768/390: displayed model rates,
  computed totals, incomplete-vs-unknown coverage, keyboard details, control bounds,
  no page overflow, empty/error/legacy/pre-migration states and no page errors.
  Screenshots visually inspected; artifacts and runner:
  `output/playwright/model-costs/{check.cjs,checks.json,cost-*.png}`.
- `graphify update .`: passed; refreshed after the concurrent module moves.

Migration `20261031000000_usage_cost_provenance` is prepared but has NOT been
executed against any database. It is required before the new usage writer runs.
Schema validation and migrated-shaped SELECT fixtures do not prove DDL application
or live writer persistence. The Cost reader supports the old schema; the migration
notice was removed at the user's request. No historical backfill, paid-provider UAT, full-app build,
invoice reconciliation, commit, push or deployment. Estimates use Standard
short-context rates; explicit cache writes, other tiers, unreported/failed attempts,
StudyMemory/ingestion calls without existing usage and provider fees remain outside
the complete billing picture.

## Comments

2026-10-31: Claimed after user approved the researched pricing/telemetry repair.

2026-10-31: Resolved locally. Removed unknown-model fallback prices, retained
provider costs with provenance, fixed Responses/Chat token normalization, split
RAG calls by actual model/step, retained rejected-answer search usage, and awaited
usage persistence before returning a completed saved turn. Existing synthetic
chat fixtures now capture token logs instead of touching a real repository.
Concurrent structural work moved adapters/workflows while this task ran; inspected
their current source and verified the preserved usage behavior in the final suite.

2026-10-31: User requested commit/push, then removal of the general cost explanation
and pending-migration banner. Removed both paragraphs and their unused UI/schema
readiness plumbing. Preparing a scoped branch in an isolated worktree so concurrent
chat refactoring and benchmark/audit work remain in the original workspace.

2026-10-31: Push preparation verified in isolated `codex/model-cost-pricing`
worktree based on `55e4f3e` (matched `origin/master` when fetched). Kept the
pre-refactor module layout and only telemetry changes; concurrent Chat extraction,
benchmark and audit changes remain in the original checkout. Scoped branch:
96/96 focused tests, typecheck, lint and Graphify passed. Used the same installed
locked dependencies through a node_modules junction; pnpm dependency auto-install
was disabled for the isolated worktree without changing dependency files. The
pre-commit lint hook remains enabled. No database migration or deployment.

Focused branch test command (original paths, without unrelated refactor tests):
`pnpm exec tsx --test src/config/pricing.config.test.ts src/repositories/token-usage.repository.test.ts src/services/analytics-cost.service.test.ts src/services/ai-cost-telemetry.test.ts src/lib/router/agent-router.test.ts src/lib/rag/knowledge-rag.test.ts src/lib/rag/knowledge-faq.test.ts src/lib/chat-latency-sse.test.ts src/lib/concise-chat.test.ts src/lib/openai-params.test.ts`.

2026-10-31: Rebuilt the production fixture after copy removal. Chromium checks
again passed at 1440/768/390; both requested paragraphs are absent, including the
pre-migration fixture state, with rates/totals/keyboard details and overflow checks
preserved. The shared and scoped Cost pages match after newline normalization.
