# knowledge-admin-02: Select and manage multiple articles

Type: feature
Status: resolved
Updated: 2026-10-13
Blocked by: none

## Scope

Add independent checkboxes and select-all for the visible page (maximum 50 rows).
Clear selection when browsing/filtering changes the page. Support confirmed bulk
deletion, including indexed passages, and optional common category/keyword changes.
Keywords replace the selected articles' keyword lists, including an explicit empty
list. Keep text, source and approval/validity fields unchanged. No bulk approval,
corpus-wide implicit selection, new schema, job queue or provider is included.

## Acceptance criteria

- Detail preview and checkbox selection are independent; select-all supports
  partial selection and keyboard access. Selection/bulk form survive failures.
- Deletion shows the selected count/titles before submitting; cancellation does
  not write. Selected article/passages deletion is atomic and exact-ID scoped.
- Category changes refresh compatible existing embeddings; keyword changes update
  lexical indexing and fingerprints without embedding calls. Legacy/stale index
  evidence must not become approved/current through metadata edits.
- Prepare embeddings before a transaction; stale selection/missing rows/provider
  failure must leave the entire selection unchanged. Preserve all approval dates.
- Admin cookie, same-origin, strict IDs/versions/patch validation and batch limits.
- Focused tests, isolated DB invariants, browser desktop/mobile checks,
  typecheck/lint, docs and Graphify refresh.

## Verification

- `pnpm exec tsx --test src/services/knowledge-admin.test.ts lib/knowledge-rag.test.ts lib/knowledge-trace.test.ts src/services/admin-workspace.test.ts src/services/playground.test.ts src/services/bot-run-review.test.ts lib/concise-chat.test.ts`: 94 passed (25 knowledge admin tests).
- `pnpm typecheck` and `pnpm lint`: passed after final UI changes.
- `pnpm test:knowledge:db`: passed using a random isolated schema and fake
  embeddings. Keyword edits retained vectors; category edits refreshed embeddings
  in one batch; metadata/index changes preserved text/source/approval fields.
  Invalid vectors rolled back earlier document updates; stale selection deletion
  failed without deleting anything; deleting two selected articles cascaded their
  passages and preserved a third unselected article exactly. Test schema cleanup
  and public corpus checksum equality passed. No paid providers were called.
- Actual Next bulk route smoke checks: missing cookie → 401, cross-origin → 403,
  invalid input → 400. No valid public mutation request was sent.
- Existing `output/playwright/knowledge-ui-check.js` passed to retain per-article
  management and reference interactions. New `knowledge-bulk-check.js` passed
  with mocked API mutations through real Next rendering, completion marker true.
  Checks covered independent detail/checkbox selection, header mixed state,
  current-page select-all, Space key, explicit metadata fields and empty keyword
  clearing, failed update/delete input retention, no automatic retry, exact
  selected versions, delete confirmation/cancellation and page shrink/selection
  reset. Cancelled source refresh retained dirty bulk edits.
- Desktop 1536×1024, mobile 390×844, tablet 1024×768 had no document horizontal
  overflow. Screenshots `output/playwright/knowledge-bulk-desktop.png` and
  `knowledge-bulk-mobile.png` were visually inspected; controls wrap on mobile.
- `graphify update .`: AST refresh passed without LLM calls.

No public corpus deletion/edit, real-provider category save UAT, production build,
commit/push or deployment was performed. Selected-page batches are capped at 50;
category embedding preparation can incur provider cost. Deletion has no UI undo.

## Comments

- 2026-10-13: Claimed after the user requested multi-select and confirmed category
  and keyword bulk edits. Reuse the current admin UI/auth/index helpers. Existing
  dirty RAG and trace work is preserved.
- 2026-10-13: Resolved after scoped verification. Selection clears on successful
  browsing or mutation, and record versions are rechecked in the transaction.
- 2026-10-13: User authorized committing all remaining changes, pushing any
  unpublished commits and shutting down the PC after remote synchronization.
  Prior commits were already synchronized with origin/master; final typecheck
  and lint passed. Remote publication is verified separately from deployment.
