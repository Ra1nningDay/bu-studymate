# admin-natural-01: Quiet admin shell, Overview and Bot Runs

Type: enhancement
Status: resolved
Updated: 2026-10-31
Blocked by: none

## Scope

Load Thai/Latin typography in the shared shell, use a neutral frame and white
sheet, reduce navigation noise without losing destinations, group KPI values,
compact the Overview charts, improve Bot Runs readability and reduce nested chrome.

## Acceptance Criteria

- [x] Shared shell, Overview and Bot Runs follow the direction with readable text.
- [x] Real metric scope/zeros/missing values and all existing destinations survive.
- [x] Sidebar toggling/preferences, filters, paging and selected-run views work.
- [x] Before/after screenshots at 1440, 768 and 390px are reviewed; overflow,
  keyboard interaction, sparse/empty/error data and font loading checked.
- [x] Typecheck, lint, focused regressions and graph refresh recorded.

## Verification

- `pnpm typecheck` and `pnpm lint`: passed after final source changes.
- `pnpm exec tsx --test src/services/admin-workspace.test.ts`: 11 passed;
  synthetic authorization, existing request behavior and Overview aggregate scope.
- `pnpm exec next build .promptfoo/natural-preview`: passed. The isolated
  production build imports the actual shell, headers, Overview, chart and Runs
  components, replacing auth and data reads only. No migrations run.
- `node output/playwright/natural-admin/check.cjs`: all 15 assertion groups
  passed on the final production fixture. Covers loaded Thai/Latin font,
  tabular figure inheritance, no horizontal page overflow at 1440/768/390,
  mobile drawer/Escape/backdrop/expanded state, all 15 original nav destinations,
  grouped mock routes, sidebar preference/reload/keyboard shortcut, search/model
  filtering, selected-run keyboard navigation, Messages/Trace/Sources/Raw, safe
  source links, server filters, filter-preserving paging, deep links, empty/error
  Runs and zero/multi-intent/populated-attention/error Overview states. No browser
  page errors. Fixture checks do not establish real browser authentication.
- Taste source lint: 0 FAIL, 2 documented WARN (ID monospace and missing-value
  em dashes). App inspector: both final pages 0 FAIL / 0 WARN at 1440x900,
  768x1024 and 390x844. Every final fold/page screenshot opened and reviewed.
- Before inspector: Overview 3 FAIL / 3 WARN; Runs 3 FAIL / 4 WARN. See
  [visual review](../visual-review.md) for the three critique rounds, scores,
  allowances and remaining phone-density limits.
- `graphify update .`: passed, AST only, no LLM call. `git diff --check`: passed.
- Evidence: `output/playwright/natural-admin/`, including `checks.json`,
  `before-overview/report.json`, `before-runs/report.json`,
  `after-overview/report.json` and `after-runs/report.json`. Rebuild the disposable
  fixture with `node output/playwright/natural-admin/setup.cjs`, then the build
  command above; start it with `pnpm exec next start .promptfoo/natural-preview -p 3036`.

No real database/provider UAT, production application build across unrelated
routes, adjacent-page visual audit, physical mobile/IME check, commit, push or
deployment. Prototype routes remain reachable. The phone keeps the existing
stacked list/detail flow and scrollable table rather than adding a new navigation
model. Existing unrelated dirty files and private environment files are intact.

## Comments

2026-10-31: Claimed after user approval. Existing dirty shell/pages and unrelated
auth, analytics, schema and orchestration changes are retained.

2026-10-31: Resolved after production-fixture screenshots and interaction checks.
Final refinements darkened status text and gave the mobile selected-run identity
its own row so actions no longer squeeze it. No additional product feature added.

Concurrent-work note: analytics date-range source and controls appeared during
the last build. They are preserved and visible in the final Runs screenshots;
this task's fixture does not validate their storage-query semantics. That work
belongs to `.scratch/analytics-dates/`. A new brand asset also appeared and was
left untouched. The final visual evidence applies to the named production fixture
at its inspection time, not later concurrent changes.
