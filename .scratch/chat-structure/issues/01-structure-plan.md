# chat-structure-01: Plan clear chat module ownership

Type: documentation
Status: resolved
Updated: 2026-10-31
Blocked by: none

## Scope

Inspect current routing/workflow/AI owners and deliver a bounded separation
[plan](../plan.md). Runtime implementation is tracked separately in ticket 02.

## Acceptance Criteria

- [x] Current ownership confirmed in source, including actual callers and aliases.
- [x] Target folders and interfaces distinguish routing, workflows, adapters and presentation.
- [x] Ordered migration includes tests, fixtures, scripts, evals, CI and explorer references.
- [x] Behavior-preservation matrix, concurrent-work risks and verification are explicit.
- [x] Local Markdown links and status index checked; runtime remains unchanged by this task.

## Verification

- Source/caller inspection: router, orchestrator, AI/fresh-info, domain services,
  controllers, presenters, tests, eval fixtures/providers, aliases and CI filters.
- Python documentation check passed: 3 documents, 5 local links, required ticket
  fields, ownership/check matrix and exactly one status-index entry.
- `git diff --check -- .scratch/README.md .scratch/chat-structure` passed.
- Only this effort's three Markdown files and the index row were authored here.
  Concurrent runtime/cost changes remain owned by their existing effort.
- No typecheck, lint, build, runtime tests, graph refresh or live UAT was run;
  this task changes documentation only. Ticket 02 remains open.

## Comments

2026-10-31: Claimed after the user requested a clear separation plan. Inspected
current source on `master`; existing cost/benchmark/harness changes are preserved.

2026-10-31: Resolved planning after source and documentation checks. The plan
defines five ordered phases and a behavior-preservation matrix. Runtime
implementation is proposed and has not started in this effort.
