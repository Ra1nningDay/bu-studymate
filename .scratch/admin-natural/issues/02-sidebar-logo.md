# admin-natural-02: Sidebar brand image

Type: enhancement
Status: resolved
Updated: 2026-10-31
Blocked by: none

## Scope

Use the supplied `public/logo-brand.png` for the shared sidebar header in place
of the SM tile and separate brand text. Preserve aspect ratio, overview link,
accessible name and the sidebar collapse control. Keep the supplied file intact.

## Acceptance Criteria

- [x] Supplied logo renders without distortion or overlap on desktop/mobile.
- [x] Overview link and sidebar controls remain usable.
- [x] Typecheck, lint and graph refresh recorded.

## Verification

- `next/image` static import preserves intrinsic 3:1 proportions and optimizes
  delivery; image displays up to 176px wide and fits beside the collapse control.
- Production fixture build passed with the actual shared shell and brand image.
- `node output/playwright/natural-admin/logo-check.cjs`: passed at 1440px and
  390px; image decoded, correct aspect ratio, no control overlap or page overflow,
  Overview link retained and collapse control usable. Both screenshots reviewed:
  `sidebar-logo-1440.png` and `sidebar-logo-390.png` in the same output folder.
- `pnpm lint`: passed. `graphify update .`: passed, AST only.
- `pnpm typecheck`: blocked by three unrelated TS2345 errors in
  `src/services/analytics-cost.service.test.ts` (lines 11, 16, 65): repository
  mocks lack the newly required `db` member. These concurrent files were not
  changed. The isolated production fixture's own typecheck passed.

No supplied-asset modification, real DB/provider UAT, commit, push or deployment.

## Comments

2026-10-31: Claimed at the user's explicit request; preserve concurrent date-filter and brand-asset work.

2026-10-31: Resolved locally after production-image and sidebar interaction checks.
