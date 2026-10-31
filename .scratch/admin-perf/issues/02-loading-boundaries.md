# admin-perf-02: Loading boundaries for admin routes

Type: enhancement
Status: resolved
Updated: 2026-10-31
Blocked by: none

## Scope

- Add `src/app/admin/loading.tsx`: a server component skeleton rendered inside
  `AdminShell` (sidebar stays, content area shows header + card placeholders).
  Follow `DESIGN.md` tokens; respect `prefers-reduced-motion`; `aria-busy` /
  visually-hidden "กำลังโหลด…" for screen readers.
- This also lets dynamic `<Link>` prefetch the shell up to the boundary, so the
  skeleton appears immediately on click.
- Add route-specific `loading.tsx` only where layout differs strongly (e.g.
  `runs/`, `knowledge/`) if the generic skeleton causes visible layout jump.
- Optionally `src/app/student/loading.tsx` with the same pattern.

## Acceptance Criteria

- [x] Clicking any sidebar item shows the skeleton within one frame in a
      production build; sidebar active state updates immediately.
- [x] No layout shift between skeleton and loaded page at 1440/768/390.
- [x] Keyboard focus and screen-reader busy state behave correctly.
- [x] typecheck, lint, graph refresh; `DESIGN.md`/docs updated if a new pattern.

## Verification

- Added `src/app/admin/loading.tsx`: header, filter, divided 4-cell metric strip (matches Overview) and two panels; `role="status"`, `aria-busy="true"`, Thai sr-only text, `motion-safe:animate-pulse`.
- Built isolated production fixture (`node .scratch/admin-perf/fixture-setup.cjs && pnpm exec next build .promptfoo/admin-perf-preview`) and ran Playwright check (`node .scratch/admin-perf/fixture-check.cjs`):
  - Verified that clicking sidebar navigation immediately displays `#admin-content [aria-busy="true"]` skeleton while the server renders, and settles into the target page with 0 horizontal overflow at 1440px, 768px, and 390px.
  - Saved screenshots in `output/playwright/admin-perf/skeleton-{1440,768,390}.png`.
- Updated `DESIGN.md` and `ARCHITECTURE.md`.
- `pnpm typecheck`, `pnpm lint`, `graphify update .`: passed.

## Comments

- 2026-10-31: Verified in production build via Playwright at 1440/768/390px. Resolved.
