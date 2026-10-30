# 04: Group lib into subdirectories (Phase 2)

Type: refactor
Status: resolved
Updated: 2026-10-30
Blocked by: none

## Scope

- Organize `src/lib/` into domain subdirectories:
  - `src/lib/rag/`: `knowledge-embedding.ts`, `knowledge-index.ts`, `knowledge-query.ts`, `knowledge-rerank.ts`, `knowledge-source.ts`, `knowledge-faq.ts`, `knowledge-rag.test.ts`, `knowledge-faq.test.ts`, `knowledge-trace.test.ts`.
  - `src/lib/study/`: `study-answer.ts`, `study-extract.ts`, `study-file.ts`, `study-material-ingest.ts`.
  - `src/lib/router/`: `agent-router.ts`, `agent-router.test.ts`, `intent.ts`.
  - `src/lib/bulinks/`: `bulinks.ts`, `bulinks.test.ts`, `fixtures/bulinks-pages.json`.
  - `src/lib/auth/`: `google-oidc.ts`, `google-oidc.test.ts`.
- Retain external SDK clients and core utilities at `src/lib/` root (`prisma.ts`, `line.ts`, `ai.ts`, `openai-stream.ts`, `fresh-info.ts`, `bot-run-review.ts`, `web-session.ts`, `chat-sse-client.ts`, `types.ts`).
- Created barrel exports (`index.ts`) for each of the 5 subdirectories.
- Configured `tsconfig.json` path mapping aliases to support both root and subpath resolution.
- Updated `package.json` test scripts (`test:bulinks`, `test:student-auth`, `test:knowledge`).
- Updated relative dynamic imports in `scripts/check-knowledge-db.ts` and `scripts/knowledge.ts`.
- Verify with `pnpm typecheck`, `pnpm lint`, all 7 test suites, and `next build`.
- Update code graph with `graphify update .`.

## Acceptance Criteria

- Subdirectories created with git mv to preserve history.
- All import paths updated cleanly.
- `package.json` test scripts updated to new test paths.
- `pnpm typecheck` passes with zero errors.
- `pnpm lint` passes with zero errors.
- All test suites pass 100%.
- `next build` compiles successfully.
- Code graph updated with `graphify update .`.

## Comments

### 2026-10-30 - Resolved
- Moved 20 domain files and test fixtures into `src/lib/{rag,study,router,bulinks,auth}/` via `git mv`.
- Created 5 barrel `index.ts` files.
- Updated `tsconfig.json` paths to include subdirectories under `@/lib/*` and `@/src/lib/*`.
- Updated test scripts in `package.json`.
- Updated `scripts/check-knowledge-db.ts` and `scripts/knowledge.ts`.
- Verified:
  - `pnpm typecheck`: 0 errors.
  - `pnpm lint`: 0 errors.
  - All test suites (`test:admin-auth`, `test:student-auth`, `test:bulinks`, `test:concise-chat`, `test:chat-latency`, `test:knowledge`, `test:openai-params`): 100% pass (264 tests).
  - `next build`: 22/22 routes compiled successfully.
  - `graphify update .`: AST updated with 909 nodes, 1435 edges.
