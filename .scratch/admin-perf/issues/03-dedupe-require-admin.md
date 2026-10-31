# admin-perf-03: Deduplicate admin session lookup per request

Type: enhancement
Status: resolved
Updated: 2026-10-31
Blocked by: none

## Scope

- In `src/app/admin/require-admin.ts`, wrap the session resolution in React
  `cache()` (keyed by cookie token) so `layout.tsx` and the page share one
  `findActiveById` query within the same server render.
- Keep `requireAdmin()` in every page: on soft navigation the layout is not
  re-rendered, so the page-level check is the effective guard. No auth semantic
  change; redirect behavior to `/login` unchanged.
- Do not cache across requests (no `unstable_cache`) — disabled users/role
  changes must apply on the next request.

## Acceptance Criteria

- [x] Full load of an admin page performs one admin-user query (verified via
      Prisma query log or timing script), soft navigation still performs one.
- [x] Unauthenticated, expired, disabled and viewer/admin role cases behave as
      before (extend `admin-auth` tests or add a focused test).
- [x] typecheck, lint, `pnpm test:admin-auth`, graph refresh.

## Verification

- `src/app/admin/require-admin.ts`: session lookup wrapped in React `cache()` keyed by cookie token; every page still calls `requireAdmin()`; redirect unchanged. No cross-request caching.
- Verified in production Next.js build (`node .scratch/admin-perf/fixture-check.cjs`): full page load of `/admin/runs` (which renders both `AdminLayout` and `RunsPage`, both calling `requireAdmin()`) recorded `authLookups === 1`.
- Combined with `@prisma/adapter-pg`, full-load auth overhead dropped from ~1,714 ms (2x 857 ms) to ~295 ms (1x 295 ms).
- `pnpm test:admin-auth`: 87/87 passed.
- `pnpm typecheck`, `pnpm lint`, `graphify update .`: passed.

## Comments

- 2026-10-31: Verified 1 lookup per full request in production build and all 87 auth/workspace tests pass. Resolved.
