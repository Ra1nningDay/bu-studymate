# Admin Users Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give admins a read-only `/admin/users` table of verified students (email, LINE ID, verified date, activity counts).

**Architecture:** One new method on `StudentAccountRepository` returns rows already joined with per-user counts (two `groupBy` queries, no N+1). A server-rendered page under `requireAdmin` shows the table, with an email search via GET `?q=`. One sidebar entry.

**Tech Stack:** Next.js 15 App Router (RSC), Prisma, `node:test` via `tsx --test`, Tailwind (copy table markup from `app/admin/tickets/page.tsx`).

**Spec:** [.scratch/student-auth/spec.md](../../../.scratch/student-auth/spec.md) (data model); no separate design doc — scope agreed in chat 2026-10-24: read-only, no unbind/delete.

## Global Constraints

- No `prisma` import outside `src/repositories/`; page imports the repository only.
- Page must call `await requireAdmin()` first (emails are personal data).
- Dates: `Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" })`, as in the tickets page.
- Read-only: no POST route, no delete/unbind control.
- Commit subjects are Conventional Commits; end with the Co-Authored-By line from the session.

## Review Focus

- `?q=` containing `%`, `_` or spaces: trimmed; empty after trim means no filter (Prisma `contains` escapes wildcards itself).
- Student with zero runs/tickets: shows `0` and `-` for last active, not a crash.
- No students (or no match): single "No students" row, `colSpan` matches column count.
- More than `limit` students: capped at 200, header shows the count shown, ordered newest `verifiedAt` first.
- `?q=` repeated (`?q=a&q=b`, Next gives an array): treated as the first value.

---

### Task 1: Repository `list`

**Files:**
- Modify: `src/repositories/student-account.repository.ts`
- Create: `src/repositories/student-account.repository.test.ts`
- Modify: `package.json` (append the new test file to `test:student-auth`)

**Interfaces:**
- Produces:
  ```ts
  export type StudentRow = { lineUserId: string; email: string; verifiedAt: Date; runs: number; tickets: number; lastActiveAt: Date | null };
  StudentAccountRepository#list(opts?: { q?: string; limit?: number }): Promise<StudentRow[]>
  ```
  `limit` defaults to 200. The constructor's `db` type widens to `Pick<typeof prisma, "$transaction" | "studentAccount" | "botRun" | "ticket">`.

- [ ] **Step 1: Write failing tests** in the new file with a fake `db` (cast `as never`) whose `studentAccount.findMany`, `botRun.groupBy`, `ticket.groupBy` record args and return fixtures. Tests:
  - `list merges run and ticket counts per lineUserId` — two accounts, runs `{U1: 3, last 2026-10-01}`, tickets `{U1: 1}`; expects U1 `{runs:3,tickets:1,lastActiveAt:<date>}` and U2 `{runs:0,tickets:0,lastActiveAt:null}`.
  - `list filters by trimmed email, ignoring blank q` — `q: "  ab "` → `findMany` where is `{ email: { contains: "ab", mode: "insensitive" } }`; `q: "   "` → `where` is `undefined`.
  - `list orders newest first and caps at limit` — asserts `orderBy: { verifiedAt: "desc" }` and `take: 200` by default, `take: 5` when `limit: 5`.
  - `list skips group queries when there are no accounts` — `botRun.groupBy` not called, returns `[]`.

- [ ] **Step 2: Run** `pnpm exec tsx --test src/repositories/student-account.repository.test.ts` → FAIL (`list is not a function`).

- [ ] **Step 3: Implement `list`.** `findMany` accounts (select `lineUserId, email, verifiedAt`), then `botRun.groupBy({ by: ["lineUserId"], where: { lineUserId: { in: ids } }, _count: { _all: true }, _max: { createdAt: true } })` and `ticket.groupBy({ by: ["lineUserId"], where: same, _count: { _all: true } })`; build maps and merge.

- [ ] **Step 4: Run** the same command → PASS. Add the file to `test:student-auth` and run `pnpm test:student-auth` → all pass (57 existing + 4 new).

- [ ] **Step 5: Commit** `feat(admin): list verified students with activity counts`

### Task 2: Page, nav, ticket

**Files:**
- Create: `app/admin/users/page.tsx`
- Modify: `app/admin/admin-shell.tsx` (add `{ href: "/admin/users", label: "Users", icon: Users }` after Knowledge Base; import `Users` from `lucide-react`)
- Create: `.scratch/student-auth/issues/04-admin-users-page.md` (same headings as issue 03; claim before starting, resolve with evidence)
- Modify: `.scratch/README.md` (one row for the effort), `ARCHITECTURE.md` only if it lists admin pages (grep first)

**Interfaces:**
- Consumes: `studentAccountRepository.list({ q })` and `StudentRow` from Task 1; `requireAdmin` from `../require-admin`.

- [ ] **Step 1: Create `UsersPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> })`**, `export const dynamic = "force-dynamic"`. Columns: Email, LINE user (monospace, truncated, same classes as tickets), Verified, Runs, Tickets, Last active. Header badge `{n} students`. Search: a plain `<form method="GET">` with `name="q"` input and a submit button; no client JS. `q` as an array uses its first element. Wrap the repository call in try/catch and reuse the tickets page's setup-notice pattern only if copying is ≤ 15 lines, otherwise render a one-line error row.
- [ ] **Step 2: Verify in browser** — `pnpm dev`, log in at `/login`, open `/admin/users`: table renders, search filters by email fragment, sidebar item is highlighted, logged-out request redirects to login, mobile width scrolls the table horizontally (wrapper `overflow-x-auto`).
- [ ] **Step 3: Run** `pnpm typecheck && pnpm lint` → both pass. Run `graphify update .`.
- [ ] **Step 4: Fill ticket 04 and README row** (checks run, "no real data check" if run against empty/test DB, known limits: read-only, runs/tickets counts only, no chat-message count, no unbind).
- [ ] **Step 5: Commit** `feat(admin): add Users page for verified students`

---

**Self-review:** spec lines covered — table (Task 2), data/counts (Task 1), search/cap/empty cases (Review Focus → Task 1 tests, Task 2 manual). Types: `StudentRow` and `list` names identical in both tasks.
