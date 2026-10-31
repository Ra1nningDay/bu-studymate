# Admin Navigation Performance Plan

Updated: 2026-10-31
Status: resolved locally (tickets 01–06 resolved; uncommitted)

## Problem

Clicking between admin pages feels slow. Source review (2026-10-31) found:

1. No `loading.tsx` or `<Suspense>` boundary anywhere in `src/app`; client
   navigation shows nothing until the whole server render finishes, and dynamic
   `<Link>` prefetch has no boundary to prefetch up to.
2. Every admin layout/page is `force-dynamic` with no data caching, so each click
   is a full server render plus fresh DB queries.
3. `requireAdmin()` runs in `admin/layout.tsx` and again in 12 pages; each call
   does `adminUserRepository.findActiveById` (user + roles). On full loads this is
   two sequential DB round-trips before page data starts. On soft navigation the
   shared layout is normally not re-rendered, so the page-level check is the one
   that protects the route and **must be kept**.
4. Overview runs 11 parallel queries including `COUNT(DISTINCT line_user_id)` on
   `chat_messages`, full-table counts of `material_chunks`, `knowledge_items`,
   `study_materials`, and `bot_runs` groupBy by date range. Only single-column
   indexes exist (`created_at`, `role`, `status`).
5. DB connection config (pooler, `connection_limit`, region) is unknown from
   source; `Promise.all` of 11 queries may queue on a small pool.
6. Some internal links (`/admin/runs?run=…`, retry links) use `<a href>` and
   force full document reloads.

## Goals / Non-goals

- Goal: instant visual feedback on every admin click; fewer sequential DB
  round-trips per navigation; measurable TTFB reduction on Overview/Runs/Costs.
- Non-goal: changing auth semantics, removing page-level auth checks, visual
  redesign, or caching per-user/sensitive data across users.

## Approach (ordered tickets)

| Ticket | Change | Risk |
|---|---|---|
| [admin-perf-01](issues/01-baseline-measurement.md) | Baseline: production-build TTFB per route + query timings/EXPLAIN (read-only) | none |
| [admin-perf-02](issues/02-loading-boundaries.md) | `admin/loading.tsx` skeleton inside shell (+ heavy routes if needed) | low |
| [admin-perf-03](issues/03-dedupe-require-admin.md) | Wrap session lookup in React `cache()` so layout+page share one query | low |
| [admin-perf-04](issues/04-overview-streaming-cache.md) | Stream Overview sections with `<Suspense>`; short TTL cache for global counts | medium |
| [admin-perf-05](issues/05-internal-links.md) | Replace internal `<a href>` with `next/link` | low |
| [admin-perf-06](issues/06-db-indexes-pooling.md) | Verify pooler/region; composite indexes only if EXPLAIN shows benefit (migration needs user approval) | medium |

## Constraints

- Keep layering: caching lives in services/repositories, not routes; no direct
  `prisma` outside repositories; use `env` not `process.env`.
- Working tree has unrelated uncommitted changes (incl. `prisma/schema.prisma`);
  preserve them. Any migration is additive and must not run against production
  without explicit user approval (`pnpm build` runs `migrate-production.mjs`).
- Each ticket: `pnpm typecheck`, `pnpm lint`, focused tests, `graphify update .`,
  update `ARCHITECTURE.md`/`docs/admin-workspace.md` where behavior changes.
