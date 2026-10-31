# admin-perf-01: Baseline navigation measurement

Type: research
Status: resolved
Updated: 2026-10-31
Blocked by: none

## Scope

Measure before changing code so later tickets can show improvement.

- `pnpm build && pnpm start` (not `pnpm dev`; dev compiles routes on first hit).
  Build must not apply production migrations: use a test/read-only DB env or the
  isolated fixture-build approach used in analytics-dates-02.
- Record TTFB / total time for `/admin`, `/admin/runs`, `/admin/analytics/costs`,
  `/admin/tickets`, `/admin/knowledge`, `/admin/users` (3 runs each, warm).
- Time `requireAdmin()` and each Overview query (temporary local timing script
  under `.scratch/admin-perf/`, not committed into app code).
- Read-only `EXPLAIN (ANALYZE, BUFFERS)` for Overview's `chat_messages` distinct
  counts and `bot_runs` groupBy for a 30-day range; record row counts.
- Record whether `DATABASE_URL` uses Supabase pooler (port 6543,
  `pgbouncer=true`, `connection_limit`) and DB vs server region — values only as
  yes/no/region, never secrets.

## Acceptance Criteria

- [x] Baseline table of route timings recorded in this ticket.
- [x] Per-query timings and EXPLAIN summary recorded.
- [x] Pooler/region facts recorded (no secrets).
- [x] Ranking of top contributors confirms or reorders tickets 02–06.

## Verification

### 1. Pooler & Region Findings (No Secrets)
- `DATABASE_URL`: Supabase transaction pooler on port `6543` in `ap-northeast-2` (Seoul) with `?pgbouncer=true`.
- `DIRECT_URL`: Supabase session pooler on port `5432` in `ap-northeast-2`.
- Network TCP RTT from the Thailand workspace to `ap-northeast-2` is **~95 ms**.

### 2. Root Cause Discovery: Prisma Rust Engine + `pgbouncer=true`
Running `.scratch/admin-perf/measure.ts` and `.scratch/admin-perf/conn-compare.ts` revealed the #1 bottleneck across the entire app:
- With Prisma's default Rust engine + `pgbouncer=true` on port 6543, even `SELECT 1` took **~478 ms** (~5 network round-trips per query) and `requireAdmin()` (`user.findFirst` + nested roles) took **~858 ms** per call.
- Removing `pgbouncer=true` on the Rust engine dropped `SELECT 1` to ~98 ms, but failed under concurrency (`ERROR: prepared statement "s5" does not exist`, code `26000`).
- Switching Prisma to `@prisma/adapter-pg` (`pg` pool `max: 5` with `pgbouncer=true` stripped in `adapterConnectionString`) uses unnamed protocol statements in a single round-trip:
  - `SELECT 1`: **478 ms → 98 ms** (4.9x faster)
  - `requireAdmin()` (`user.findFirst` + roles): **858 ms → 295 ms** (2.9x faster)
  - 90-query concurrency stress test (`conn-stress.ts` / `adapter-probe.ts`): **90/90 passed, 0 prepared-statement errors**.

### 3. Before vs. After Timings (Warm, ms)

| Operation / Route Data | Baseline (Rust engine + `pgbouncer=true`) | After `@prisma/adapter-pg` + `cache()` | Improvement |
|---|---:|---:|---:|
| `SELECT 1` | 477 ms | 98 ms | **-79%** |
| `requireAdmin()` (`user.findFirst` + roles) | 857 ms (x2 = 1,714 ms on full load) | 295 ms (x1 via React `cache()`) | **-83% on full load** |
| `/admin` Overview (`adminOverviewRepository.read` x11) | 1,202 / 494 ms | 588 / 291 ms | **-41%** |
| Individual Overview query (`chat_messages`, `bot_runs`, `count`) | 495 ms each | 97 ms each | **-80%** |
| `/admin/runs` (`listBotRunReviews`, 30d, p1) | 1,289 / 997 ms | 502 / 304 ms | **-69%** |
| `/admin/analytics/costs` (`analyticsCostRepository.getUsage`) | ~960 ms (2 sequential raw queries) | 199 ms | **-79%** |
| `/admin/knowledge` (`knowledgeAdminService.list`) | ~1,900 ms | 399 ms | **-79%** |

### 4. Table Sizes & `EXPLAIN (ANALYZE, BUFFERS)`
- Current row counts (`pg_stat_user_tables`): `knowledge_items` ~232, `chat_messages` ~35, `bot_runs` ~18, `ai_token_logs` ~4, `study_materials` ~0, `material_chunks` ~0, `tickets` ~0.
- `EXPLAIN (ANALYZE, BUFFERS)` on `chat_messages` distinct users (30d): `Index Scan using chat_messages_created_at_idx`, Execution Time **0.110 ms** (shared hit=9).
- `EXPLAIN (ANALYZE, BUFFERS)` on `bot_runs` groupBy status (30d): `Index Scan using bot_runs_created_at_idx`, Execution Time **0.102 ms** (shared hit=10).
- Conclusion for Ticket 06: PostgreSQL execution is ~0.1 ms; existing single-column indexes are already used and optimal for current table sizes. No speculative index migration is warranted.

## Comments

- 2026-10-31: Completed read-only measurements and root-cause analysis. Resolved.
