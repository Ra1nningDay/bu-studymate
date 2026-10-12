# knowledge-admin-02: Select and manage multiple articles

Type: feature
Status: claimed
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

Pending. No deletion/edit of the public corpus is authorized by this UI task.

## Comments

- 2026-10-13: Claimed after the user requested multi-select and confirmed category
  and keyword bulk edits. Reuse the current admin UI/auth/index helpers. Existing
  dirty RAG and trace work is preserved.
