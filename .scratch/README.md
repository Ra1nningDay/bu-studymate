# StudyMate Work Status

Updated: 2026-10-27

This index owns local work status. Specs and tickets own scope and verification;
[AGENTS.md](../AGENTS.md) owns working rules. A plan is not implementation proof.

## Current Handoff

- Latest effort: Group lib into subdirectories ([app-structure-04](app-structure/issues/04-group-lib-subdirectories.md)),
  resolved locally on 2026-10-30; uncommitted.
  Previous effort: Two-Tier Error Handling Architecture ([error-handling-01](error-handling/issues/01-two-tier-error-handling.md)),
  resolved locally on 2026-10-30; uncommitted.
  Previous effort: Clean lib facades and presenters ([app-structure-03](app-structure/issues/03-clean-lib-facades-and-presenters.md)),
  resolved locally on 2026-10-30; uncommitted.
  Previous effort: Move lib/ to src/lib/ ([app-structure-02](app-structure/issues/02-move-lib-to-src-lib.md)),
  resolved locally on 2026-10-30; uncommitted.
  Previous effort: Move app/ to src/app/ ([app-structure-01](app-structure/issues/01-move-app-to-src-app.md)),
  resolved locally on 2026-10-30; uncommitted.
  Previous effort: Chat Orchestration, RAG & SSE Streaming Latency ([chat-latency-01](chat-latency/issues/01-orchestration-rag-sse.md)),
  resolved locally on 2026-10-27; not committed or deployed.
  Previous effort: BU Links live lookup ([bulinks-live-01](bulinks-live/issues/01-live-lookup.md)),
  implemented locally on branch `feat/bulinks-live-lookup`, 2026-10-24; not merged or deployed.
  Previous effort: FAQ file import ([knowledge-rag-05](knowledge-rag/issues/05-faq-file-import.md)),
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
| Group lib into subdirectories | Resolved locally, 2026-10-30; uncommitted | [app-structure-04](app-structure/issues/04-group-lib-subdirectories.md) | 20 domain files grouped into 5 subdirectories (rag, study, router, bulinks, auth) with barrel exports and path aliases. All 264 unit tests, typecheck, lint, build (22/22 routes) pass. |
| Two-tier error handling | Resolved locally, 2026-10-30; uncommitted | [error-handling-01](error-handling/issues/01-two-tier-error-handling.md) | AppError, HTTP errors, handleApiError, domain errors in study and ticket, 9 new unit tests, 8/8 test suites pass, build 22/22 routes. |
| Clean lib facades and presenters | Resolved locally, 2026-10-30; uncommitted | [app-structure-03](app-structure/issues/03-clean-lib-facades-and-presenters.md) | 7 legacy files removed, templates moved to presenter. 264 unit tests, typecheck, lint, build (22/22 routes), and graphify update passed. |
| Move lib to src/lib | Resolved locally, 2026-10-30; uncommitted | [app-structure-02](app-structure/issues/02-move-lib-to-src-lib.md) | All 40 files moved with `git mv`. `typecheck`, `eslint`, all test suites, and `next build` (22/22 routes) passed cleanly. |
| Move app to src/app | Resolved locally, 2026-10-30; uncommitted | [app-structure-01](app-structure/issues/01-move-app-to-src-app.md) | All 52 files moved with `git mv`. `typecheck`, `eslint`, all unit test suites, `next build` (22/22 routes), and `graphify update .` passed cleanly. |
| Chat orchestration, RAG & SSE latency | Resolved locally, 2026-10-27; uncommitted | [chat-latency-01](chat-latency/issues/01-orchestration-rag-sse.md) | 260 unit tests across 8 suites (5 new latency/SSE + 47 knowledge + 20 concise-chat + 188 regressions), `pnpm typecheck`, `pnpm lint`, and `graphify update .` passed. Synthetic DB/fetch mocks; live DB/provider TTFT UAT and deployment remain separate. |
| BU Links live lookup | Resolved locally, 2026-10-24; not merged or deployed | [bulinks-live-01](bulinks-live/issues/01-live-lookup.md) | 16 bulinks + 19 concise-chat + 46 knowledge tests (fake fetch), typecheck/lint passed. Live read-only GET smoke of bulinks.bu.ac.th and a six-question sample (real router and models, no DB writes) recorded; calendar and BU NEWS link-only; known limits in ticket. |
| Users + RBAC admin login | Implemented locally, 2026-10-24; migration applied to the connected DB, not deployed | [users-rbac-01](users-rbac/issues/01-users-roles-admin-login.md) | Admin-auth + student-auth suites, typecheck/lint passed (fake repositories). Checked on a throwaway Postgres (counts, admin:create, login, viewer 403) and migration applied to the connected DB (0 students); no deployed run. |
| Admin login hardening | Implemented locally, 2026-10-24; production secret not set | [admin-auth-01](admin-auth/issues/01-session-secret-and-login-limit.md) | 33 admin-auth tests (fake limiter/auth), typecheck/lint passed. No real login-limit or Vercel IP header check. |
| Admin Users page | Implemented locally, 2026-10-24; authenticated browser check pending | [student-auth-04](student-auth/issues/04-admin-users-page.md) | 66 student-auth tests (fake db), typecheck/lint passed; unauthenticated redirect only. No real-data or deployment check. |
| Student link notice | Implemented locally, 2026-10-24; real LINE push pending | [student-auth-03](student-auth/issues/03-link-notice.md) | 57 student-auth tests with a fake push, typecheck/lint passed. No real push or deployment. |
| LINE student gate | Implemented locally, 2026-10-24; real LINE check pending | [student-auth-02](student-auth/issues/02-line-gate.md) | 53 student-auth tests with fake LINE/DB, typecheck/lint passed. No real LINE, card rendering or deployment check. |
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
