# admin-perf-05: Client-side navigation for internal links

Type: enhancement
Status: resolved
Updated: 2026-10-31
Blocked by: none

## Scope

Replace same-tab internal `<a href="/admin/...">` with `next/link`:
`admin/chat/run-trace.tsx` (Bot Runs link), retry links in `admin/runs/page.tsx`
and `admin/knowledge/page.tsx`, and action link in `admin/agent/workflow/page.tsx`.
Keep external and `target="_blank"` links as `<a>` (e.g. report links in `playground.tsx`).

## Acceptance Criteria

- [x] `rg '<a href="/admin' src/app` returns only intentional new-tab links.
- [x] Links navigate without full document reload; styling unchanged.
- [x] typecheck, lint, graph refresh.

## Verification

- Replaced same-tab `<a href="/admin...">` with `next/link` in:
  - `src/app/admin/chat/run-trace.tsx`
  - `src/app/admin/runs/page.tsx`
  - `src/app/admin/knowledge/page.tsx`
  - `src/app/admin/agent/workflow/page.tsx`
- Confirmed `rg '<a href="/admin|<a href=\{`/admin' src/app` only matches the intentional `target="_blank"` report link in `src/app/admin/chat/playground.tsx`.
- `pnpm typecheck`, `pnpm lint`, `graphify update .`: passed.

## Comments

- 2026-10-31: All internal same-tab admin links converted to `next/link`. Resolved.
