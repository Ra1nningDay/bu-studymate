# StudyMate Work Status

Updated: 2026-10-12

This index owns local work status. Specs and tickets own scope and verification;
[AGENTS.md](../AGENTS.md) owns working rules. A plan is not implementation proof.

## Current Handoff

- Latest completed effort: Web Chat reference UI,
  ticket [admin-03](admin-dashboard/issues/03-chat-ui.md), verified locally.
  Documentation workflow remains recorded below.
- Baseline: existing Next.js application with web/LINE chat, study memory,
  campus knowledge and ticket flows. The inspected working tree also contains
  uncommitted router, concise-chat and Playground work. Its presence is source
  evidence only; testing, release and deployment status have not been established
  by this documentation task.
- Before continuing: read the relevant ticket, check branch and `git status`,
  and preserve unrelated changes. No implementation backlog has been imported
  from GitHub or inferred from the existing dirty files.

| Effort | Status | Record | Evidence boundary |
|---|---|---|---|
| Web Chat reference UI | Resolved, 2026-10-12; uncommitted | [admin-03](admin-dashboard/issues/03-chat-ui.md) | Desktop/tablet/mobile UI assertions, 24 regressions, typecheck, source lint and AST refresh passed. No real DB/provider UAT or deployment. |
| Bot Runs reference UI | Resolved, 2026-10-12; uncommitted | [admin-02](admin-dashboard/issues/02-runs-ui.md) | Desktop/mobile browser checks, 10 regressions, typecheck, application lint and AST graph refresh passed. No real DB/provider UAT or deployment. |
| Unified Admin Workspace | Resolved, 2026-10-12; uncommitted | [admin-01](admin-dashboard/issues/01-unified-workspace.md) | 42 regressions, typecheck/lint, isolated browser checks, configured DB aggregate read and AST refresh passed. No paid-provider/operational UAT or deployment. |
| Admin Playground | Resolved, 2026-10-12; uncommitted | [playground-01](playground/issues/01-admin-playground.md) | 32 regressions, typecheck/lint, isolated API/browser checks and graph refresh passed. No real DB/provider UAT or deployment. |
| Documentation workflow | Resolved, 2026-10-12 | [docs-01](documentation-setup/issues/01-documentation-workflow.md) | Markdown reference/format checks passed; no application or deployment checks. |

Next action: use `/login` for the unified workspace. Use a test database for
real-provider/operational testing; reference UI follow-ups retain their own tickets.
Review current Git status first; preserve concurrent work. No commit, release
or additional product implementation task is assumed.

## Recording Work

Follow [local issue conventions](../docs/agents/issue-tracker.md). Add one row
per effort and keep detailed history in its plan/spec and tickets. Update this
index when status changes. Record the next action and blockers for a handoff.

Use **planned** for proposed behavior, **source-inspected** for code found in
the named revision/working tree, and **verified** only with the check and result
in the ticket. A resolved documentation ticket does not resolve an application
feature. Keep local checks, live UAT, deployment and remote issue closure as
separate claims.
