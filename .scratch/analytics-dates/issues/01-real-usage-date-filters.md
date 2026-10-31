# analytics-dates-01: Recorded usage and Bangkok date filters

Type: enhancement
Status: resolved
Updated: 2026-10-31
Blocked by: none

## Scope

Use saved usage in Cost instead of fallback examples. Include legacy BotRun token
totals without double counting detailed logs or inventing input/output prices.
Add URL-backed inclusive Bangkok date filters to Overview, Runs and Cost. Preserve
existing auth, run inspection/filtering/paging and unrelated dirty work.

## Acceptance Criteria

- [x] All three pages filter storage by the selected Bangkok calendar days.
- [x] Invalid/reversed/overlarge ranges show an error before querying data.
- [x] Cost distinguishes zero, missing prices and load errors; no sample metrics.
- [x] Legacy usage is read without mutation and not counted again with token logs.
- [x] Focused regressions, typecheck, lint, graph refresh and UI checks recorded.

## Verification

- `pnpm exec tsx --test src/lib/analytics-date-range.test.ts src/lib/bot-run-review.test.ts src/services/analytics-cost.service.test.ts src/services/admin-workspace.test.ts`: 24/24 passed.
- `pnpm typecheck` and `pnpm lint`: passed. One typecheck run during the root
  build saw disappearing generated `.next/types` files; the standalone rerun passed.
- `graphify update .`: passed. Initial `jg` discovery produced no output and was
  stopped; targeted current-source reads and Graphify queries supplied discovery.
- Read-only PostgreSQL check through the actual cost repository/service found
  245,635 legacy tokens from Jan 1 through Oct 31, 2026: Sep 8 (66,674), Oct 12
  (16,187), Oct 24 (146,757), Oct 28 (16,017). Detailed table exists, but these
  records have no usable per-model price breakdown. Daily/model sums reconcile.
- Same-day real storage check for Oct 28: Overview and paginated Runs count both
  return 2 runs; Cost returns 16,017 tokens in exactly one chart day.
- PostgreSQL SELECT-only CTE fixture executes the actual repository query, with
  and without the log table branch: complete overlap, partial overlap, legacy-only,
  logs exceeding the old total, standalone logs, invalid JSON metadata, cross-day
  linked log timestamps, and exclusive final-day boundaries pass. No fixture rows
  are inserted. Re-run `pnpm exec tsx output/playwright/analytics-dates/sql-check.ts`.
- Isolated production-rendered fixture build and Playwright passed for all three
  pages at 1440/768/390px. Dates and controls stay in viewport; no page-wide overflow.
  Verified keyboard submit, dates/paging/filter preservation, applying filters resets
  page, single-day/empty/error/legacy data, malformed/reversed/overlarge dates,
  no sample values, daily numeric disclosure and a 304-day internally scrolling chart.
  Screenshots and `checks.json`: `output/playwright/analytics-dates/`.
- Full copied application build in `.promptfoo/analytics-app-build` exited 0 and
  generated all routes. Its embedded ESLint emitted a plugin-resolution warning;
  repository `pnpm lint` independently passed. The direct root build had compiled
  but failed page collection with missing generated `_not-found` / legacy-report
  modules. The isolated build avoids shared `.next` output; no source workaround
  or dependency change was introduced. Runner:
  `node output/playwright/analytics-dates/full-build-setup.cjs --build`.

No migration, backfill writes, provider calls, commit, push or deploy. Browser checks
use synthetic auth/storage; real database checks are read-only service/repository
checks, not authenticated production UAT. Stored estimates are not repriced, and
no historical model/input/output splits or missing provider usage are invented.

## Comments

2026-10-31: Claimed. Default window is seven Bangkok calendar days including today;
custom ranges allow up to 366 days. Tickets and knowledge remain current snapshots.

2026-10-31: Resolved locally, uncommitted. Removed Cost sample fallbacks, hardcoded
growth/averages/semantic-cache savings and the unused fixed-window helper. Uses
available recorded estimates and clearly counts unpriced tokens. Existing schema,
usage writers, pricing config and concurrent shell/logo/auth work are preserved.
