# admin-perf-04: Stream Overview and cache global counts

Type: enhancement
Status: resolved
Updated: 2026-10-31
Blocked by: [admin-perf-01](01-baseline-measurement.md)

## Scope

- Split `AdminOverviewRepository.read` into smaller reads used by independent
  async server components on `/admin`:
  - range-scoped metrics, conversation chart, intent chart, and attention list (`readRangeMetrics`)
  - global corpus counts (`readCorpusCounts`: knowledge items, study materials, chunks)
  Wrapped in `<Suspense>` with skeletons so the page shell/filter and Knowledge Snapshot stream cleanly.
- Global, non-user-specific corpus counts: cache in the service layer with
  `unstable_cache` (TTL 60s, tag `admin-overview-counts`); invalidate via
  `revalidateTag` from knowledge and study-material write paths.
- Keep existing error UX: a failing section shows its own alert instead of the
  whole page failing.

## Acceptance Criteria

- [x] Overview header/filter render before data; sections stream independently.
- [x] Numbers identical to current implementation for the same range
      (existing admin-workspace tests updated/passing).
- [x] Measured Overview TTFB improves vs. ticket 01 baseline.
- [x] Layering rules respected; typecheck, lint, graph refresh; docs updated.

## Verification

- `src/repositories/admin-overview.repository.ts`: split `readRangeMetrics(start, end)` and `readCorpusCounts()`, while preserving `read(start, end)` compatibility.
- `src/services/admin-overview.service.ts`: added `readCorpusSnapshot()` backed by `unstable_cache` (60s TTL, tag `admin-overview-counts`) with safe fallback outside Next.js request context, and `invalidateOverviewCorpusCounts()` called in `knowledge-admin.service.ts` (save/bulk delete) and `study-memory.service.ts` (saveStudyNote).
- `src/app/admin/page.tsx`: wrapped `OverviewBody` and `KnowledgeSnapshotStream` in `<Suspense>` boundaries with accessible skeletons (`OverviewBodyFallback` renders `AdminPageHeader` + `DateRangeFilter` immediately).
- `pnpm test:admin-auth` (includes `admin-workspace.test.ts` + new corpus snapshot cache/fallback test): 87/87 passed.
- Playwright production build check (`node .scratch/admin-perf/fixture-check.cjs`): verified streaming fallback and final rendered counts.
- Measured warm `adminOverviewRepository.read` dropped from **494 ms → 291 ms** (and cached corpus counts save 3 DB queries per Overview load).

## Comments

- 2026-10-31: Implemented, tested with unit + Playwright production fixture checks. Resolved.
