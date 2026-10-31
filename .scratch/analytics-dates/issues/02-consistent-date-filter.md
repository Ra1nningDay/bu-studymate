# analytics-dates-02: Shared DateRangeFilter layout

Type: enhancement
Status: resolved
Updated: 2026-10-31
Blocked by: none

## Scope

Use one DateRangeFilter in Overview, Bot Runs and Cost below the page header and
before metrics. Standardize label/input/button sizing, alignment and spacing;
keep helper text below controls and provide 7/30/90/365-day presets everywhere.
Separate Bot Runs date filtering from its other filters, preserving dates and
server filters across form submissions, presets, pagination and URL refresh.

## Acceptance Criteria

- [x] One component, position and responsive geometry across all three pages.
- [x] Same presets and selected state; calculation uses Bangkok today.
- [x] Dates and run server filters survive independent filter submissions.
- [x] Desktop/mobile alignment, keyboard, URL and invalid/empty states verified.
- [x] Focused checks, typecheck, lint, graph refresh and documentation recorded.

## Verification

- Replaced `AnalyticsDateFilter` / separate `AnalyticsDateFields` with
  `src/app/admin/date-range-filter.tsx: DateRangeFilter`; all page/error callers
  updated. Shared 192px desktop date fields, 44px controls and 12px gaps; helper
  below the control group. Identical placement below headers and before metrics.
- Presets use server-supplied Bangkok today, avoiding a client time-zone/midnight
  recomputation; selected range has an accessible current state. No new dependency.
- Bot Runs date submission/presets retain applied server filters, clear page/run
  selection, and leave page-scoped search/model behavior intact. Its additional
  form carries hidden dates; Reset clears other filters but retains dates.
- `pnpm typecheck`, `pnpm lint`: passed after final source edits.
- Focused date-range, run-review, cost and admin-workspace tests: 24/24 passed.
- Production fixture build: `pnpm exec next build .promptfoo/date-filter-preview`
  passed. Imports actual pages, shell, components and Cost service with synthetic
  auth/data boundaries; no configured DB or provider calls.
- Playwright `node output/playwright/date-filter/check.cjs`: passed. Measures and
  compares filter geometry on every page at 1440/1280/768/390px; equal field widths,
  44px control height, 1440px baseline alignment, helper below controls and
  header/filter/KPI order. No document overflow; all controls inside viewport.
- Checked all four preset lengths/end date, active state, keyboard activation,
  preservation of status/intent/channel/target/web-search, reset of page/selection,
  independent form submissions, additional Reset, reload and browser Back.
  Invalid-range recovery preserves filters; empty/load-error states keep the
  shared filter. No browser page errors. Numeric geometry also checks that hidden
  preserved filters do not add spacing. Reviewed desktop and mobile screenshots.
- Screenshots and machine-readable results: `output/playwright/date-filter/`.
- `graphify update .` and scoped `git diff --check`: passed.

No database/provider calls, migration, commit, push or deployment. Browser evidence
uses synthetic persistence/auth; live authenticated UAT was not performed.

## Comments

2026-10-31: Claimed after consistency feedback. Keep existing URL/date validation
and usage calculation; no additional dependencies or backend pricing changes.

2026-10-31: Resolved locally, uncommitted. Browser checks caught extra spacing
caused by hidden filter inputs participating in `space-y`; moved them inside the
control row and verified equal geometry with active filters. Test selectors were
adjusted to the existing select names, and Back checks wait for the client render.
