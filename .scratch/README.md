# StudyMate Work Status

Updated: 2026-10-23

This index owns local work status. Specs and tickets own scope and verification;
[AGENTS.md](../AGENTS.md) owns working rules. A plan is not implementation proof.

## Current Handoff

- Latest effort: FAQ file import ([knowledge-rag-05](knowledge-rag/issues/05-faq-file-import.md)),
  migrated and imported on 2026-10-24; two retrieval gaps recorded in the ticket.
  Previous completed effort: Knowledge multi-select and bulk actions,
  ticket [knowledge-admin-02](knowledge-admin/issues/02-bulk-actions.md), verified locally.
  Hybrid knowledge's additive Supabase migration was applied in the prior effort.
  Real corpus import remains deferred by the user.
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
| Student Google sign-in (bumail.net) | Implemented locally, 2026-10-23; manual Google/LINE check pending | [student-auth-01](student-auth/issues/01-google-signin.md) | 42 tests with fake Google/LINE/DB, typecheck/lint passed. Migration SQL written, not applied; no real OAuth client, bumail account, LINE or deployment check. |
| FAQ file import + action links | Resolved, 2026-10-24; migrated and imported to the connected database | [knowledge-rag-05](knowledge-rag/issues/05-faq-file-import.md) | 45 knowledge tests + related, typecheck/lint passed. Isolated-schema DB check passed; 220 items imported, after keyword equivalents a 13-question sample answered 12 right/1 correct miss, links unchecked, no deployment. |
| Knowledge bulk actions | Resolved, 2026-10-13 | [knowledge-admin-02](knowledge-admin/issues/02-bulk-actions.md) | 94 tests, isolated DB rollback/cascade/preservation checks, synthetic desktop/mobile UI, auth/origin smoke, typecheck/lint and AST refresh passed. Commit/push authorized; no public mutations, real-provider save UAT or deployment. |
| Knowledge execution trace | Resolved, 2026-10-13; uncommitted | [knowledge-rag-04](knowledge-rag/issues/04-execution-trace.md) | 78 tests, isolated SQL rank/count checks, synthetic desktop/mobile UI, typecheck/lint and AST refresh passed. No real model/corpus UAT or deployment. |
| Knowledge admin tab | Resolved, 2026-10-13; uncommitted | [knowledge-admin-01](knowledge-admin/issues/01-knowledge-tab.md) | 82 regressions, isolated DB filters/counts, authenticated read/origin checks, reference desktop/mobile UI, typecheck/lint and AST refresh passed. No real-provider save UAT or deployment. |
| Knowledge query rewrite | Resolved, 2026-10-13; uncommitted | [knowledge-rag-03](knowledge-rag/issues/03-query-rewrite.md) | 24 focused tests, 51 regressions, typecheck/lint and AST refresh passed. No new DB check, real model/corpus UAT or deployment. |
| Knowledge reranker | Resolved, 2026-10-13; uncommitted | [knowledge-rag-02](knowledge-rag/issues/02-reranker.md) | 19 focused tests, 51 regressions, isolated Supabase 40-candidate/checksum checks, typecheck/lint and AST refresh passed. No real model/corpus UAT or deployment. |
| Hybrid campus knowledge | Resolved, 2026-10-13; uncommitted | [knowledge-rag-01](knowledge-rag/issues/01-hybrid-knowledge.md) | 14 focused tests, 51 regressions, isolated Supabase checks, migration, typecheck/lint and AST refresh passed. No real corpus/model UAT or deployment; cron prepared only. |
| Web Chat reference UI | Resolved, 2026-10-12; uncommitted | [admin-03](admin-dashboard/issues/03-chat-ui.md) | Desktop/tablet/mobile UI assertions, 24 regressions, typecheck, source lint and AST refresh passed. No real DB/provider UAT or deployment. |
| Bot Runs reference UI | Resolved, 2026-10-12; uncommitted | [admin-02](admin-dashboard/issues/02-runs-ui.md) | Desktop/mobile browser checks, 10 regressions, typecheck, application lint and AST graph refresh passed. No real DB/provider UAT or deployment. |
| Unified Admin Workspace | Resolved, 2026-10-12; uncommitted | [admin-01](admin-dashboard/issues/01-unified-workspace.md) | 42 regressions, typecheck/lint, isolated browser checks, configured DB aggregate read and AST refresh passed. No paid-provider/operational UAT or deployment. |
| Admin Playground | Resolved, 2026-10-12; uncommitted | [playground-01](playground/issues/01-admin-playground.md) | 32 regressions, typecheck/lint, isolated API/browser checks and graph refresh passed. No real DB/provider UAT or deployment. |
| Documentation workflow | Resolved, 2026-10-12 | [docs-01](documentation-setup/issues/01-documentation-workflow.md) | Markdown reference/format checks passed; no application or deployment checks. |

Next action: for campus RAG, follow [the import guide](../docs/knowledge-rag.md)
when reviewed knowledge is available; calibrate quality and configure CRON_SECRET
before production deployment. Use `/login` for the unified workspace. Use a test database for
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
