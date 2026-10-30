# 02: Move lib to src/lib

Type: refactor
Status: resolved
Updated: 2026-10-30
Blocked by: none

## Scope

- Move root `lib/` to `src/lib/` using `git mv`
- Update `package.json` test scripts pointing to `lib/` -> `src/lib/`
- Update `tailwind.config.ts` content paths (remove redundant `./lib/`)
- Support `@/lib/*` and `@/src/lib/*` in `tsconfig.json` paths
- Update relative imports in `scripts/` (`../lib/` -> `../src/lib/`)
- Update docs (`AGENTS.md`, `ARCHITECTURE.md`, `README.md`)
- Verify with `pnpm typecheck`, `pnpm lint`, tests, and `next build`

## Acceptance Criteria

- `src/lib` contains all adapters, clients and facades previously in `lib/`.
- Root `lib/` is removed.
- `pnpm typecheck` passes with zero errors.
- `pnpm lint` passes with zero errors.
- All test suites (`test:admin-auth`, `test:student-auth`, `test:knowledge`, `test:bulinks`, `test:concise-chat`, `test:chat-latency`, `test:openai-params`) pass 100%.
- `next build` compiles successfully.
- Code graph updated with `graphify update .`.

## Comments

### 2026-10-30 - Resolved
- All 40 files in `lib/` moved to `src/lib/` via `git mv`.
- Added `"@/lib/*": ["./src/lib/*"]` to `tsconfig.json` paths for seamless backward-compatibility.
- Updated `tailwind.config.ts` content paths.
- Updated `package.json` test scripts pointing to `src/lib/`.
- Updated relative imports in `scripts/*.ts`.
- Updated docs in `AGENTS.md`, `ARCHITECTURE.md`, `README.md`.
- Ran `pnpm typecheck` (passed), `pnpm lint` (passed), all 7 test suites (passed), `next build` (passed 22/22 routes), and `graphify update .`.
