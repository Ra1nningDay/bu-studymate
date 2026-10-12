# docs-01: Establish StudyMate Documentation Workflow

Type: documentation
Status: resolved
Updated: 2026-10-12
Blocked by: none

## Scope

Implement the [documentation setup plan](../plan.md) only. Preserve unrelated
working-tree work and existing coding/discovery rules.

## Acceptance Criteria

- [x] `ARCHITECTURE.md` maps current source owners and separates source evidence from verification.
- [x] `DESIGN.md` records current UI conventions and labels unverified target behavior.
- [x] `AGENTS.md` points to conditional context and the authoritative local work index.
- [x] Local issue conventions and `architecture-decisions/` references agree across documents.
- [x] Local Markdown links/fences and whitespace pass; task writes are confined to documentation and concurrent changes are recorded.

## Verification

- Nine Markdown files, 72 local references: all resolve; fences balanced; no trailing whitespace.
- Scoped `git diff --check`: passed for modified tracked documentation.
- Compared AGENTS to the saved pre-edit working-tree version: coding rules and `jg`/Graphify discovery order preserved.
- Baseline comparison: 131 unrelated file hashes matched; six differed during the task (listed below). This is not evidence that the entire working tree remained unchanged.
- No application tests, typecheck/lint, browser/LINE, database or paid-provider checks. No graph update, remote mutation, commit, push or deployment.

This ticket verifies documentation adoption, not application behavior.

## Comments

2026-10-12: Claimed for the user's documentation/workflow request. Existing
uncommitted features are not adopted as resolved tickets.

2026-10-12: Initial hash-unchanged criterion could not establish whole-tree
stability because concurrent edits appeared. Replaced it with the scoped-write
criterion and recorded the observation rather than reverting unrelated work.
Differences were observed in `.playwright-cli/console-2026-10-12T09-14-15-584Z.log`,
`graphify-out/GRAPH_REPORT.md`, `graphify-out/graph.json`,
`src/services/playground.test.ts`, `src/controllers/playground.controller.ts`
and `app/chat/page.tsx`. This task's write operations target only the nine
documentation files. Their links/format and agent-rule changes passed review.
