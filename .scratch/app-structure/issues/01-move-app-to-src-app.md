# 01: Move app to src/app

Type: refactor
Status: resolved
Updated: 2026-10-30
Blocked by: none

## Scope

- Move root `app/` to `src/app/`
- Update `tailwind.config.ts` content paths
- Update `@/app` imports in tests/sources
- Update docs (`AGENTS.md`, `ARCHITECTURE.md`, `DESIGN.md`, `README.md`)
- Verify with `pnpm typecheck`, `pnpm lint`, tests, and `next build`

## Acceptance Criteria

- `src/app` contains all pages, components and routes previously in `app/`.
- Root `app/` is removed.
- `pnpm typecheck` passes with zero errors.
- `pnpm lint` passes with zero errors.
- Unit tests (`test:admin-auth`, `test:student-auth`, `test:knowledge`, `test:bulinks`, `test:concise-chat`, `test:chat-latency`, `test:openai-params`) pass 100%.
- Next.js build (`next build`) compiles and generates 22 routes successfully.
- Code graph updated with `graphify update .`.

## Comments

### 2026-10-30 - Resolved
- All 52 files in `app/` moved to `src/app/` via `git mv`.
- Updated `tailwind.config.ts` content path to `./src/**/*.{js,ts,jsx,tsx,mdx}`.
- Updated `lib/knowledge-trace.test.ts` import from `@/app/...` to `@/src/app/...`.
- Updated documentation in `AGENTS.md`, `ARCHITECTURE.md`, `DESIGN.md`, `README.md`.
- Ran `pnpm typecheck` (passed), `pnpm lint` (passed), all 7 test suites (passed), `next build` (compiled all 22 routes cleanly), and `graphify update .`.
