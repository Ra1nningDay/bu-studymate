# Agent Workflow explorer

Approved: 2026-10-31. Read-only admin screen at `/admin/agent/workflow`.

Show source-confirmed routing (campus knowledge, fresh information, study memory,
tickets, chat/policy), then the selected saved run's actual ordered execution
steps. Reuse Bot Runs reads, date filters, authentication, trace validation and
RAG detail presentation. Preserve dates, server filters, page and selection in
links between Workflow and Bot Runs. No provider calls or writes.

Use the existing framed-sheet shell, Thai font and emerald selection. The screen
answers: which route did this question take, and which recorded step needs review?
Missing telemetry stays missing; recorded step states are not service health.
RRF duration is included in Hybrid Retrieval, never counted again.

Design: framed-sheet, seed 36447838, brand palette/type retained, no redraw.
The product's saved routing and evidence become the map and selectable timeline.

See [agent-workflow-01](issues/01-workflow-explorer.md) for checks and limits.
