# 01: Structured Logger Migration

Type: refactor
Status: in-progress
Updated: 2026-10-30
Blocked by: none

## Scope

- Install and configure `pino` (and dev tools) as a lightweight, serverless-friendly structured logger.
- Add `LOG_LEVEL` environment configuration to `src/config/env.ts` with Zod validation (`debug`, `info`, `warn`, `error`, `silent`).
- Implement `src/lib/logger/` (or `src/lib/logger.ts`) providing:
  - Strongly typed `Logger` facade.
  - Automatic sensitive data redaction (`authorization`, `password`, `token`, `secret`, `cookie`).
  - Child logger factory for request correlation (`requestId`, `userId`, `route`).
- Integrate `logger` with `src/errors/error-handler.ts` replacing raw `console.error`.
- Migrate high-value log points:
  - Agent Router shadow mode & fallbacks (`src/lib/router/agent-router.ts` & update tests).
  - AI & RAG pipelines (`src/lib/ai.ts`, `src/lib/rag/knowledge-query.ts`, `src/lib/rag/knowledge-rerank.ts`, `src/services/knowledge.service.ts`).
  - Study extraction & answer generation (`src/lib/study/study-extract.ts`, `src/lib/study/study-answer.ts`).
  - Auth rate limiting & link failures (`src/controllers/admin-auth.controller.ts`, `src/controllers/student-auth.controller.ts`).
- Add unit tests for logger functionality (`src/lib/logger/logger.test.ts`).
- Verify with `pnpm typecheck`, `pnpm lint`, unit test suites, `next build`, and `graphify update .`.

## Acceptance Criteria

- `src/lib/logger/` exports `logger` and `createRequestLogger`.
- All logs in production output standard single-line JSON to stdout.
- Sensitive fields (auth headers, passwords, session tokens) are redacted automatically.
- `handleApiError` logs operational vs critical errors via `logger.error` with stack trace & error code.
- `src/lib/router/agent-router.test.ts` and all existing unit test suites pass cleanly.
- `pnpm typecheck` and `pnpm lint` pass with 0 errors.
- `next build` builds all 22/22 routes successfully.
