# admin-perf-06: DB pooling check and evidence-based indexes

Type: enhancement
Status: resolved
Updated: 2026-10-31
Blocked by: [admin-perf-01](01-baseline-measurement.md)

## Scope

- Inspect `DATABASE_URL` / `DIRECT_URL` pooling and per-query round-trip latency.
- Fix Prisma transaction-pooler multi-round-trip overhead by wiring `@prisma/adapter-pg` in `src/lib/prisma.ts` and documenting the pooler setup in `.env.example` and `ARCHITECTURE.md`.
- Check `EXPLAIN (ANALYZE, BUFFERS)` on Overview / Runs queries and add composite indexes only if EXPLAIN proves they are needed.

## Acceptance Criteria

- [x] Pooler/region recommendation documented and Prisma driver adapter wired for 1-round-trip transaction-pooler queries.
- [x] Each added index justified by before/after EXPLAIN on a test DB (or skipped if EXPLAIN shows sub-millisecond index scans).
- [x] `pnpm typecheck`, `pnpm lint`, graph refresh; `ARCHITECTURE.md` and `.env.example` persistence notes updated.

## Verification

- Wired `@prisma/adapter-pg` (`pg` pool `max: 5`) in `src/lib/prisma.ts` with `adapterConnectionString()` stripping Prisma-only `pgbouncer=true` parameter so `node-postgres` executes unnamed protocol statements over Supabase's port 6543 transaction pooler in a single round-trip:
  - Per-query `SELECT 1`: **478 ms → 98 ms**
  - `requireAdmin()` query: **858 ms → 295 ms**
  - 90-query concurrent stress test (`adapter-probe.ts`): **90/90 succeeded, 0 prepared-statement errors**.
- Verified `EXPLAIN (ANALYZE, BUFFERS)` in `admin-perf-01`:
  - `chat_messages` 30-day distinct count uses `Index Scan using chat_messages_created_at_idx` in **0.110 ms**.
  - `bot_runs` 30-day status groupBy uses `Index Scan using bot_runs_created_at_idx` in **0.102 ms**.
  - Per scope ("Only indexes that EXPLAIN proves useful"), no migration was added.
- Updated `.env.example` and `ARCHITECTURE.md`.
- `pnpm typecheck`, `pnpm lint`, `pnpm test:admin-auth` (87/87): passed.

## Comments

- 2026-10-31: Driver adapter wired and verified against live Supabase pooler; EXPLAIN confirmed existing indexes execute in ~0.1 ms. Resolved.
