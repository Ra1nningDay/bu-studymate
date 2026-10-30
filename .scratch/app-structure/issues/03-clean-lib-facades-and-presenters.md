# 03: Clean lib facades and presenters

Type: refactor
Status: resolved
Updated: 2026-10-30
Blocked by: none

## Scope

- Remove legacy facade shims in `src/lib/`:
  - `src/lib/ticket.ts`
  - `src/lib/bot.ts`
  - `src/lib/knowledge.ts`
  - `src/lib/study-memory.ts`
  - `src/lib/rate-limit.ts`
  - `src/lib/chat-logs.ts`
- Update all callers of those facades to import directly from `src/services/` or `src/repositories/`:
  - `src/app/admin/tickets/page.tsx` -> `src/services/ticket.service`
  - `src/lib/study-file.ts` -> `src/services/study-memory.service`
  - `src/presenters/chat-response.presenter.ts` -> `src/services/rate-limit.service`
- Move `src/lib/flex-messages.ts` into `src/presenters/line-flex.templates.ts` and wire into `src/presenters/line-flex.presenter.ts`. Remove `src/lib/flex-messages.ts`.
- Fix `src/lib/bulinks.test.ts` relative fixture path to `src/lib/fixtures/bulinks-pages.json`.
- Verify with `pnpm typecheck`, `pnpm lint`, all test suites, and `next build`.
- Update code graph with `graphify update .`.

## Acceptance Criteria

- Legacy facade shims (`ticket.ts`, `bot.ts`, `knowledge.ts`, `study-memory.ts`, `rate-limit.ts`, `chat-logs.ts`) deleted from `src/lib/`.
- Presentation code (`flex-messages.ts`) moved from `src/lib/` to `src/presenters/`.
- `pnpm typecheck` passes with zero errors.
- `pnpm lint` passes with zero errors.
- All test suites pass 100%.
- `next build` compiles successfully.
- Code graph updated with `graphify update .`.

## Comments

### 2026-10-30 - Resolved
- Removed 6 obsolete facade shims (`src/lib/ticket.ts`, `src/lib/bot.ts`, `src/lib/knowledge.ts`, `src/lib/study-memory.ts`, `src/lib/rate-limit.ts`, `src/lib/chat-logs.ts`) with `git rm`.
- Replaced callers (`admin/tickets/page.tsx`, `study-file.ts`, `chat-response.presenter.ts`) with direct imports from services.
- Created `src/presenters/line-flex.templates.ts` and removed `src/lib/flex-messages.ts`.
- Fixed `bulinks.test.ts` fixture path.
- Verified:
  - `pnpm typecheck`: 0 errors.
  - `pnpm lint`: 0 errors.
  - All test suites (`test:admin-auth`, `test:student-auth`, `test:bulinks`, `test:concise-chat`, `test:chat-latency`, `test:knowledge`, `test:openai-params`): 100% pass (264 tests).
  - `next build`: 22/22 routes compiled successfully.
  - `graphify update .`: AST updated with 889 nodes, 1422 edges.
