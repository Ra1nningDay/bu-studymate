# Repository Guidelines: BU StudyMate

## Start of Task and Documentation

- Read [.scratch/README.md](.scratch/README.md) and the relevant plan/ticket before changes; check branch and `git status` and preserve unrelated work.
- Read [ARCHITECTURE.md](ARCHITECTURE.md) for onboarding, ownership, call paths, persistence or integration changes; confirm affected behavior in source.
- Read [DESIGN.md](DESIGN.md) for UI, LINE presentation, interaction or copy changes.
- For domain terminology or decisions, read [CONTEXT.md](CONTEXT.md) and relevant ADRs using [domain guidance](docs/agents/domain.md).
- Update affected documentation and ticket evidence in the same task. Read references when their condition applies; loading every document for every task is unnecessary.
- `.scratch/README.md` owns work status; plans describe intent. Claim a ticket before multi-step work, record checks and limitations, then resolve it and update the index only when its acceptance criteria are satisfied.

## Project Overview & Technology Stack

**BU StudyMate** is an intelligent assistant for Bangkok University students, supporting course note management, AI-assisted tutoring, campus knowledge Q&A, and classroom issue reporting (ticketing).

- **Framework**: Next.js 15 (App Router), React 19
- **Package Manager & Runtime**: `pnpm` (Node.js 20+)
- **Language**: TypeScript (strict mode)
- **Database & ORM**: PostgreSQL (Supabase) with Prisma ORM
- **AI / LLM Integration**: OpenAI / OpenRouter API, Semantic Intent Routing
- **Messaging Integration**: LINE Messaging API (Webhooks, Flex Messages, Loading Animation, Rich Menu)

---

## Project Structure & Layered Architecture

The codebase follows a clean **Layered Architecture**:

```
bu-studymate/
├── app/
│   ├── api/                   # Thin Route Handlers (HTTP entry points only)
│   │   ├── chat/              # Web chat and file upload endpoints
│   │   ├── line/              # LINE webhook & imagemap endpoints
│   │   └── admin/             # Admin ticket status management
│   ├── admin/                 # Admin dashboard pages (React Server Components)
│   └── chat/                  # Web chat client interface
├── src/
│   ├── config/                # Centralized environment & config validation (Zod)
│   ├── controllers/           # HTTP controllers (request parsing, DTO validation, status codes)
│   ├── dtos/                  # Data Transfer Objects & Zod validation schemas
│   ├── services/              # Pure Business Logic, state machines & AI orchestration
│   ├── presenters/            # UI formatting, LINE Flex templates & Web response shaping
│   ├── repositories/          # Data Access Layer (all Prisma queries encapsulated here)
│   └── data/                  # Static seed data (e.g. bu-knowledge.ts)
├── lib/                       # External SDK clients (line.ts, prisma.ts, ai.ts) & facade exports
├── prisma/                    # Prisma schema (schema.prisma) and migrations
└── scripts/                   # Operational scripts (seed-knowledge, rich menu upload, migrations)
```

---

## Build, Test, and Development Commands

Use `pnpm` with the committed lockfile (`pnpm-lock.yaml`):

```powershell
pnpm install                   # Install dependencies
pnpm dev                       # Start Next.js development server
pnpm build                     # Build production bundle
pnpm start                     # Start production server
pnpm typecheck                 # TypeScript check (tsc --noEmit)
pnpm lint                      # ESLint check (eslint .)
pnpm db:generate               # Generate Prisma Client
pnpm db:migrate:dev            # Apply migrations in local/dev
pnpm db:migrate:deploy         # Apply migrations in production/deploy
pnpm seed:knowledge            # Seed BU Knowledge Base items
pnpm line:richmenu:upload      # Upload and set LINE Rich Menu
```

Run both `pnpm typecheck` and `pnpm lint` before submitting or completing code changes.

---

## Coding Style & Architecture Conventions

- **Strict TypeScript**: Write clean, strongly-typed TypeScript. Always infer types from Zod schemas when defining DTOs.
- **Thin Route Handlers**: Files in `app/api/**/route.ts` must remain thin (delegate to `src/controllers/` in 3-7 lines).
- **No Direct Database Queries in Services or Routes**: Never `import { prisma }` directly in controllers, services, or routes. Use `src/repositories/`.
- **Decoupled UI & Presentation**: Do not generate LINE Flex Messages or hardcoded chat templates inside services. Use `src/presenters/`.
- **Safe Environment Variables**: Never access `process.env.XXX` directly in application logic. Import `env` from `@/src/config/env` for type-safe and validated configuration.
- **Naming Conventions**:
  - `camelCase` for variables and functions (`handleWebChat`, `createTicket`)
  - `PascalCase` for classes, types, and schemas (`ChatController`, `ChatRequestSchema`)
  - File naming: `kebab-case.ts` (e.g., `ticket.service.ts`, `line-flex.presenter.ts`)

---

## Security, Secrets & Commits

- **Never commit secrets**: Never commit `.env`, `.env.local`, API keys (`OPENAI_API_KEY`), LINE secrets (`LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`), database credentials, or admin passwords.
- Keep `.env.example` updated and categorized whenever new environment variables are introduced.
- **Conventional Commits**: Use concise Conventional Commit subjects:
  - `feat: ...` for new features
  - `fix: ...` for bug fixes
  - `refactor: ...` for architectural and code improvements
  - `docs: ...` for documentation
  - `chore: ...` for dependency or build updates

---

## jevgrep and Graphify

This project has a Graphify knowledge graph at `graphify-out/`.

Rules:
- Use `jg "<question>" .` first when behavior is unfamiliar or the relevant files/symbols are unknown. Read its results before further discovery.
- If `jg` provides sufficient context, continue with targeted file reads or `rg`; avoid redundant repository-wide searches.
- When the exact path, symbol, or string is already known, skip `jg` and use direct reads or `rg`.
- Use Graphify for dependency relationships, call paths, architecture, and cross-module impact analysis: `graphify query`, `graphify path`, or `graphify explain`.
- When present, use `graphify-out/wiki/index.md` for broad navigation; otherwise use `ARCHITECTURE.md` and graph queries. Read `graphify-out/GRAPH_REPORT.md` only when deeper graph context is needed. Confirm graph claims in current source; inferred edges and planned docs are not implementation proof.
- If a discovery tool fails or is unavailable, record the limitation and continue with targeted source reads; avoid repeatedly running a stalled broad search.
- After modifying code, run `graphify update .` to keep the graph current.

## Agent Skills

- Issues/specs: local `.scratch/` Markdown; see [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md).
- Domain: `CONTEXT.md`, ADRs in `architecture-decisions/`; see [docs/agents/domain.md](docs/agents/domain.md).
- Distinguish plans from implementation using [.scratch/README.md](.scratch/README.md) and tickets; record verification separately from deployment or release.
