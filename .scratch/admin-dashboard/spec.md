# Unified Admin Workspace

Updated: 2026-10-12
Status: verified locally; uncommitted
Ticket: [admin-01](issues/01-unified-workspace.md)

Implement the user-approved routing proposal and dashboard reference: `/login`,
protected `/admin` Overview, `/admin/chat` combining Playground and web testing,
existing `/admin/runs` and `/admin/tickets`, with shared navigation and one cookie
login. Root and old chat/Playground URLs redirect to their replacements. Protect
web/admin APIs, preserve uploads and LINE webhook signature behavior.

Use real seven-day conversation/run/latency/intent aggregates and current open
tickets/knowledge counts. Define metrics explicitly; do not invent resolution,
source indexing status, trends or unsupported settings/search features.
Preserve existing data/schema and unrelated working-tree changes.
