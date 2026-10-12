# admin-02: Bot Runs Reference Layout

Type: feature
Status: resolved
Updated: 2026-10-12
Blocked by: none

## Scope

Restyle `/admin/runs` using the supplied reference: metric cards, compact run
table and selected-run inspection panel within the existing admin shell.
Preserve authentication, server filters and pagination. Search/model filtering
operate on the loaded page and say so. Do not invent trends, step durations,
tool calls or session identifiers absent from persisted review data.

## Acceptance Criteria

- [x] Reference-style cards/table/details with responsive mobile stacking.
- [x] Select runs, navigate details, inspect messages/logs/sources/raw data.
- [x] Existing filters/pagination/auth and setup/empty/error states preserved.
- [x] Focused interaction checks, typecheck, lint and graph refresh recorded.

## Verification

- Browser checks through real Next rendering with the existing isolated
  in-memory fixture (unreachable DB URL and disabled provider keys): initial
  unauthenticated redirect, 12 rows, selection, previous/next run, all views,
  linked Thai messages, router details, sources, raw data, Thai search, model
  filtering, server status/channel filtering, error/empty states, deep links,
  filter-preserving pagination and invalid page handling passed.
- Desktop 1536×1024 and mobile 390×844: screenshots inspected, menu and keyboard
  selection checked, no page-wide horizontal overflow. Fresh-tab render/hydration
  check found no console/page errors. A transient caret-style hydration warning
  occurred after Playwright screenshot/HMR; clean fresh-tab verification passed.
- Assert-based UI check: `node C:/Users/tkham/AppData/Local/Temp/studymate-runs-ui-20261012/run-runs-check.cjs`.
  Fresh-tab check: append the same directory's `runs-fresh-check.js` absolute path.
  These disposable scripts are outside the source tree and depend on the
  pre-existing memory fixture on 3025.
- `pnpm exec tsx --test src/services/admin-workspace.test.ts`: 10 passed.
- `pnpm typecheck`: passed. Changed-file ESLint: passed.
- Plain `pnpm lint` encountered 424 errors in pre-existing generated
  `.promptfoo/admin-ui-build` artifacts. `pnpm lint --ignore-pattern '.promptfoo/**'`
  passed across the application; no lint config or other task's artifacts changed.
- `graphify update .`: passed, AST-only, no LLM/provider call.
- Evidence: `output/playwright/runs-desktop.png`, `runs-mobile.png`. Database
  failure notice was source-inspected; live database failure was not injected.

No real-provider/database UAT, production build, commit, push or deployment.
Missing step times, tool-call records and trends remain explicit limitations.

## Comments

2026-10-12: Claimed. Preserve existing dirty Admin Workspace and other work.

2026-10-12: Resolved after local UI and regression verification. The existing
sidebar/header were reused. No repository/query/schema/auth changes; source
URLs remain HTTP(S)-only links. Database load errors show a generic retry notice
instead of exposing raw database exception details.
