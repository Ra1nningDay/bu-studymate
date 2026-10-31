# admin-natural-03: Select the supplied favicon variant

Type: enhancement
Status: resolved
Updated: 2026-10-31
Blocked by: none

## Scope

Choose the white/mint S on a rounded green square from `public/favicon.png`.
Extract it with the built-in image tool and install a compact 16/32/48px ICO
through the existing Next App Router favicon convention. Preserve the source
contact sheet. No extra icon options, dependencies or metadata configuration.

## Acceptance Criteria

- [x] Selected icon readable at favicon sizes, ICO entries valid.
- [x] Next renders a favicon link and serves the ICO.
- [x] Checks and limitations recorded.

## Verification

- Built-in imagegen extracted the selected white/mint S on a green rounded square.
  The generated master is copied into the ignored project evidence folder;
  `sharp` from the installed Next dependencies only resizes/encodes ICO entries.
- Final application asset: `src/app/favicon.ico`, 9,462 bytes, PNG-backed ICO
  entries at 16/32/48px with alpha. The original `public/favicon.png` is unchanged.
- `node output/playwright/natural-admin/make-favicon.cjs`: ICO header, image entry
  dimensions and alpha assertions passed. All three rendered sizes visually checked.
- `pnpm typecheck`, `pnpm lint`: passed in the current working tree.
- `pnpm exec next build .promptfoo/natural-preview`: passed using actual components
  and a copied favicon. Production HTTP check confirmed the generated icon link,
  `/favicon.ico` HTTP 200, image content type and all three ICO entries.
- `git diff --check`: passed. Asset/docs-only change, no TS/config/dependency edits.

No real DB/provider UAT, deployment, commit or push. Browser tab-cache refresh
was not tested on the user's existing tab; a cached old icon may need a new tab.

## Built-in image tool prompt

Edit target: the provided StudyMate favicon option sheet. Extract ONLY the large second option from the left in the top row: the dark emerald green rounded square containing the white and pale mint folded-ribbon S symbol. Produce ONE standalone square favicon master, centered front-on, tightly fitted to the full square canvas with only transparent corner cutouts. Preserve the existing S silhouette, fold geometry, white/mint colors, green background and rounded-square shape as closely as possible. Remove the entire surrounding contact sheet, all labels, pixel-size numbers, browser mockups and all other options. Clean the noisy neon edge artifacts. No text, no labels, no new design elements, no drop shadow outside the square, no mockup, no padding around the square. This is extraction of the selected existing option, not a redesign. Crisp anti-aliased contours for 16px and 32px favicon use; actual transparent corners.

## Comments

2026-10-31: Claimed. Selected the white S on green for contrast on light/dark tabs.

2026-10-31: Resolved after icon-size and production-serving checks.

2026-10-31 follow-up: Reopened after the user's existing tab still showed the
generic globe. Live localhost:3000 `/login` includes `/favicon.ico`; the ICO
returns 200, image/x-icon, 9462 bytes and SHA-256 exactly matching the workspace.
Thus the server asset is current; the old-tab cache is a hypothesis, not confirmed
browser state. Add a 32px `icon.png` through the Next metadata convention to get
a content-versioned URL and validate it in a fresh browser against port 3000.

2026-10-31 follow-up resolved: Added `src/app/icon.png` (32px). The actual
localhost:3000 login now emits `/icon.png?09b3b2da9dd1f2d3` after the ICO fallback.
`node output/playwright/natural-admin/check-live-favicon.cjs` failed before the
change for a missing versioned PNG, then passed after it: HTTP 200, image/png,
32x32 and byte hash matching the workspace. The user confirmed the new icon
appeared ("มาละ"). No further browser interaction or cache changes needed.
The old-tab cache remains a likely explanation, not a proven browser-cache trace.
