# playground-01: Chat, Saved Traces and Conversation Reports

Type: feature
Status: resolved
Updated: 2026-10-12
Blocked by: none

## Scope

Implement the [Playground spec](../spec.md). Preserve unrelated uncommitted router,
concise-chat and documentation work. No commit, push, deployment or migration.

## Acceptance Criteria

- [x] Protected admin Playground, APIs and reports; absent password closes access.
- [x] Send through shared web orchestration with existing limits and unique test identity.
- [x] Inspect linked successful/failed turns and distinguish unrecorded trace data.
- [x] Continue a saved session and restore it after reload in the same tab.
- [x] Open a fresh report containing the whole stored transcript and all runs.
- [x] Show real-write/provider behavior before testing; no automatic POST retries.
- [x] Desktop/mobile browser checks with isolated memory persistence and no paid provider.
- [x] Focused regressions, typecheck, lint and final graph refresh pass after cleanup.

## Verification

- `pnpm exec tsx --test src/services/playground.test.ts`: 14 passed (auth, CSRF,
  host/proxy regression, session boundary, limits, stored run ID, failures,
  repository scoping, malformed metadata and shared orchestration).
- `pnpm test:concise-chat`: 18 passed.
- Browser with real Next routes/rendering and an injected in-memory Prisma fixture:
  login; success/error trace selection; unsafe URL/HTML text handling; reload;
  shared send; fresh report after another turn; new identity; mobile 390px without
  horizontal overflow. Screenshots: `output/playwright/`.
- Final combined command `pnpm exec tsx --test src/services/playground.test.ts lib/concise-chat.test.ts`: 32 passed, no failures.
- Final `pnpm typecheck`, `pnpm lint` and `graphify update .`: passed. Graph refresh was AST-only, with no LLM call; disposable fixture scripts are outside the source graph.
- Browser also verified send-failure recovery, deterministic shared guide routing,
  logout, unauthenticated report redirect and session API 401. The fixture server
  was stopped after verification.
- Existing `http://localhost:3000/admin/playground` returned 200 with the
  missing-`ADMIN_PASSWORD` setup state. Configure/reload the intended server
  environment before testing real conversations.

These checks do not prove real PostgreSQL persistence, paid-model quality, LINE
delivery or deployment. The disposable server disables provider keys and uses
a deliberately unreachable fixture database URL, with all exercised persistence
handled in memory. Real-environment checks remain a separate step.

## Comments

2026-10-12: Implementation authorized with “ทำเลย”. Work records were added after
the repository's local documentation workflow appeared during this task. Browser
tests reproduced POST body consumption by a copied NextRequest and internal/public
host mismatch; both fixed with focused regression coverage. Final cleanup/checks
remain before resolution.

2026-10-12: Resolved after all local criteria passed. Preserved unrelated router,
concise-chat and concurrent documentation changes. No environment-file change,
database migration, paid provider evaluation, commit, push or deployment.

2026-10-12: [admin-01](../../admin-dashboard/issues/01-unified-workspace.md) moved
the workspace to `/admin/chat` and shared `/login` auth. Old Playground/report
URLs redirect; this ticket's original verification remains historical evidence.
