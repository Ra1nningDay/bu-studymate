# Move app directory to src/app Plan

## Motivation

Standardize Next.js App Router structure into `src/app` so that all application code lives under `src/` (`src/app`, `src/controllers`, `src/services`, `src/repositories`, `src/presenters`, `src/dtos`, `src/config`).

## Scope

1. Move `app/` to `src/app/` using `git mv app src/app` to preserve git file history.
2. Update Tailwind configuration (`tailwind.config.ts`) to scan `./src/**/*.{js,ts,jsx,tsx,mdx}`.
3. Update any imports referencing `@/app/...` (e.g. `lib/knowledge-trace.test.ts`).
4. Update documentation references in `ARCHITECTURE.md`, `DESIGN.md`, `README.md`, `AGENTS.md`.
5. Verify build, typecheck, lint, and relevant test suites.
6. Run `graphify update .`.
