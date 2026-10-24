# Single Users Table + RBAC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the shared `ADMIN_PASSWORD` login with per-person admin accounts in one `users` table (students and admins together) governed by `roles` / `user_roles`.

**Architecture:** `users` holds identity (email, optional `line_user_id`, optional `password_hash`, `disabled_at`); roles `student`, `admin`, `viewer` link through `user_roles`. `StudentAccountRepository` is repointed from `student_accounts` to `users` (it is the only student data access), the old table is kept one release. Admin login is email + scrypt password; the cookie holds only `userId` + expiry and every admin request re-reads the user and roles from the database, so disabling or changing roles takes effect at once. Writes need role `admin`; reads accept `admin` or `viewer`.

**Tech Stack:** Prisma + SQL migration, `node:crypto` scrypt (no new dependency), Next.js 15, `node:test` via `tsx --test`.

**Spec:** none written; design agreed in chat 2026-10-24 (email + password in DB; roles `admin` and `viewer`; single users table). **Prerequisite:** branch from `feat/admin-login-hardening` (this plan builds on its `ADMIN_SESSION_SECRET` and login rate limit; merge or stack it first).

## Global Constraints

- No `prisma` import outside `src/repositories/`; config only via `env` from `@/src/config/env`; controllers stay thin.
- Emails are stored and compared lowercased and trimmed.
- Password storage format: `scrypt$16384$<saltHex>$<hashHex>` (salt 16 bytes, key 64 bytes), compared with `timingSafeEqual`. No plaintext or hash in logs, errors or API responses.
- Only roles `admin` and `viewer` may sign in to the admin workspace. The student Google flow can only grant role `student`, never `admin`/`viewer`.
- Keep: cookie name `studymate-admin`, 8 h expiry, `HttpOnly`/`SameSite=Strict`, same-origin check, login rate limit (`adminLoginRateLimitConfig`), `/login?login=failed` redirect.
- `ADMIN_PASSWORD` and `ADMIN_USERNAME` are removed from `env.ts`, `.env.example` and docs by the end; `ADMIN_SESSION_SECRET` stays (32+ chars) and is what makes the workspace "configured".
- Migration is additive; `student_accounts` stays in the database and in `schema.prisma` (marked deprecated) until a later contract migration.
- Conventional Commits ending with the session's Co-Authored-By line.

## Review Focus

- Student Google sign-in with an email that already belongs to an admin: attaches `line_user_id` + role `student` to that user and never adds an admin role (Task 1 `bind` test).
- "Delete student" on a user who is also an admin: only unlinks LINE and removes `student`; the admin can still sign in (Task 1 `remove` test).
- Unknown email vs wrong password vs disabled user vs student-only user: identical failure (`null`), and a hash is still verified for unknown emails to equalize timing (Task 2).
- Disabled user or removed role with a still-valid cookie: next request is unauthenticated/forbidden (Task 2).
- Old-format cookie (pre-migration `13digits.32hex.64hex`) and tampered userId: rejected, no throw (Task 2).
- Viewer calling any write endpoint: 403 with no side effect; viewer reading: 200 (Task 3).
- `pnpm admin:create` on an existing email adds the role without resetting the password; `--reset` on an unknown email fails (Task 4).

---

### Task 1: Schema, backfill, and student repository on `users`

**Files:**
- Modify: `prisma/schema.prisma` (add `User`, `Role`, `UserRole`; keep `StudentAccount` with a `/// Deprecated` comment)
- Create: `prisma/migrations/20261024120000_users_roles/migration.sql`
- Modify: `src/repositories/student-account.repository.ts`, `src/repositories/student-account.repository.test.ts`

**Interfaces:**
- Produces (Prisma): `User { id String @id uuid, email String @unique, lineUserId String? @unique @map("line_user_id"), passwordHash String? @map("password_hash"), verifiedAt DateTime? @map("verified_at"), disabledAt DateTime? @map("disabled_at"), createdAt, roles UserRole[] }`, `Role { id, name @unique }`, `UserRole { userId, roleId, @@id([userId, roleId]), onDelete: Cascade }`, tables `users`, `roles`, `user_roles`.
- Migration SQL: create the three tables; `INSERT` roles `student`, `admin`, `viewer`; backfill `users` from `student_accounts` (`lower(email)`, `line_user_id`, `verified_at`) and give each backfilled user role `student`.
- Unchanged public API of `StudentAccountRepository`: `bind({lineUserId,email}): Promise<BindResult>`, `findByLineUserId(id): Promise<{lineUserId,email}|null>` (null when user missing, disabled, or without role `student`), `list({q,limit}): Promise<StudentRow[]>` (only users with role `student` and a `line_user_id`), `remove({lineUserId,confirmEmail})` (unlink: set `line_user_id` and `verified_at` null and delete the `student` `user_roles` row; never delete the user row). `bind` rules: existing user by `lineUserId` → `unchanged` if same email else `line_taken`; existing user by email with a different `lineUserId` → `email_taken`; existing user by email without LINE (e.g. an admin, or a previously unlinked student) → attach `lineUserId`, `verifiedAt`, role `student` → `bound`; else create user with role `student` → `bound`.

- [ ] **Step 1: Rewrite the repository tests** against a fake `db` exposing `user` (`findUnique`, `findMany`, `create`, `update`), `role`/`userRole` as needed, `botRun.groupBy`, `ticket.groupBy`, `$transaction(fn) => fn(db)`. Keep the existing list/remove assertions (merge counts, trimmed email filter, ordering/cap, skip group queries when empty, mismatch/not_found, case-insensitive confirm) and add: `bind attaches LINE and student role to an existing admin user without adding admin`, `bind returns email_taken when the email is linked to another LINE id`, `remove unlinks and drops only the student role, never deletes the user`, `findByLineUserId ignores disabled users`.
- [ ] **Step 2: Run** `pnpm exec tsx --test src/repositories/student-account.repository.test.ts` → FAIL.
- [ ] **Step 3: Add the models and write the migration SQL**, then `pnpm db:generate`. Implement the repository against `user` using nested `roles: { some: { role: { name: "student" } } }` filters; role rows are looked up by name inside the transaction.
- [ ] **Step 4: Run** the repository test and `pnpm test:student-auth` → PASS (66+), `pnpm typecheck` → clean.
- [ ] **Step 5: Apply the migration to an isolated/test database** (never the production URL) with `pnpm db:migrate:dev` and check that `select count(*)` of `users` equals `student_accounts` and each has role `student`; record the result in the ticket.
- [ ] **Step 6: Commit** `feat(users): single users table with roles, students repointed`

### Task 2: Password hashing and DB-backed admin sessions

**Files:**
- Create: `src/services/password.ts`, `src/services/password.test.ts`
- Create: `src/repositories/admin-user.repository.ts`
- Modify: `src/services/admin-auth.service.ts`, `src/controllers/admin-auth.controller.ts`, `app/login/page.tsx`, `app/admin/require-admin.ts`
- Create: `src/services/test-support/admin-auth-fixture.ts` (in-memory fake repository + helper used by all auth tests)
- Test: `src/services/admin-auth.service.test.ts`, update `src/controllers/admin-auth.controller.test.ts`

**Interfaces:**
- Produces:
  ```ts
  hashPassword(password: string): Promise<string>
  verifyPassword(password: string, stored: string): Promise<boolean>   // false for malformed `stored`
  type AdminRole = "admin" | "viewer";
  type AdminSession = { userId: string; email: string; roles: AdminRole[] };
  AdminUserRepository#findByEmail(email): Promise<{ id; email; passwordHash: string | null; disabledAt: Date | null; roles: string[] } | null>
  AdminUserRepository#findActiveById(id): Promise<AdminSession | null>   // null if missing, disabled, or no admin/viewer role
  new AdminAuthService(secret?: string, users?: Pick<AdminUserRepository, "findByEmail" | "findActiveById">)  // secret defaults to env.ADMIN_SESSION_SECRET
  AdminAuthService#configured: boolean                              // Boolean(secret)
  AdminAuthService#login(email: string, password: string, now?: number): Promise<string | null>   // token
  AdminAuthService#getSession(token: string | undefined, now?: number): Promise<AdminSession | null>
  AdminAuthService#authenticate(request: Request): Promise<AdminSession | null>
  AdminAuthService#authorize(request: Request, need: "read" | "write"): Promise<"ok" | "unauthenticated" | "forbidden">
  ```
  Token format `<expMs13>.<userId uuid>.<hmacSha256Hex>`; HMAC over `admin:<expMs>.<userId>` with the secret. `authorize`: `write` needs role `admin`; `read` needs `admin` or `viewer`.
- `createSession`, `isAuthenticated`, `isRequestAuthenticated`, `ADMIN_USERNAME`/`ADMIN_PASSWORD` usage are deleted from the service (callers are migrated in Task 3).

- [ ] **Step 1: Write failing tests.** `password.test.ts`: `hash then verify round-trips`, `wrong password and malformed stored value return false`, `two hashes of the same password differ`. `admin-auth.service.test.ts` with the fixture: `login returns a token for an active admin or viewer`, `login returns null for unknown email, wrong password, disabled user and student-only user` (and asserts the unknown-email path still ran `verifyPassword` once via an injected spy or timing-neutral counter on the fake), `getSession reflects role changes and disabling immediately`, `getSession rejects expired, tampered, old-format and wrong-secret tokens without throwing`, `authorize: viewer read ok / viewer write forbidden / admin write ok / no cookie unauthenticated`, `a secret without users cannot log anyone in` (`configured` true, `login` null). Update `admin-auth.controller.test.ts`: login form fields are `email` + `password`; keep the 429/redirect/fail-open cases.
- [ ] **Step 2: Run** `pnpm exec tsx --test src/services/password.test.ts src/services/admin-auth.service.test.ts src/controllers/admin-auth.controller.test.ts` → FAIL.
- [ ] **Step 3: Implement** `password.ts` (scrypt via `node:crypto` `scrypt` promisified), the repository (`findByEmail` lowercases/trims; roles flattened to names), and the service. For an unknown email, verify against a module-level precomputed dummy hash and return `null`. Update `AdminAuthController.login` to read `email` and call `auth.login`; update `app/login/page.tsx` (field `email`, `type="email"`, no default value, `autoComplete="username"`) and make it use `await adminAuthService.getSession(...)`; make `requireAdmin()` await `getSession` and redirect to `/login` when `null`.
- [ ] **Step 4: Run** the same command → PASS; `pnpm typecheck` will fail only in the controllers/tests that still call `isRequestAuthenticated`; that is Task 3's scope.
- [ ] **Step 5: Commit** `feat(admin-auth): email and password login backed by users and roles`

### Task 3: Enforce roles at every admin entry point

**Files:**
- Modify: `src/controllers/chat.controller.ts` (lines ~43, ~92), `knowledge-admin.controller.ts` (`guard`), `playground.controller.ts` (`authorized`), `ticket.controller.ts`, `student-admin.controller.ts`, `app/admin/**` pages that call `requireAdmin`
- Modify tests: `src/services/admin-workspace.test.ts`, `playground.test.ts`, `knowledge-admin.test.ts`, `src/controllers/student-admin.controller.test.ts` (replace `new Auth("pw")`/`createSession` with the Task 2 fixture and cookie helper; fakes expose `authorize`)

**Interfaces:**
- Consumes: `AdminAuthService#authorize(request, need)` from Task 2.
- Produces: each controller maps `"unauthenticated"` → 401 and `"forbidden"` → 403 using its existing JSON shape. Permission per endpoint: **write** = chat send, chat upload, playground send, knowledge save/bulk/source/check, ticket status update, student delete; **read** = knowledge list/read, playground list/read, every admin page via `requireAdmin`.

- [ ] **Step 1: Write failing tests** in each affected suite using a viewer fixture: `viewer can read but every write endpoint returns 403 before any work` (assert the fake service/repository was not called), and keep the existing "unauthenticated → 401 before any work" and "cross-origin → 403" tests, now via the fixture cookie. One shared table-driven test in `admin-workspace.test.ts` iterates all write endpoints.
- [ ] **Step 2: Run** `pnpm exec tsx --test src/services/admin-workspace.test.ts src/services/playground.test.ts src/services/knowledge-admin.test.ts src/controllers/student-admin.controller.test.ts` → FAIL.
- [ ] **Step 3: Replace** every `isRequestAuthenticated(request)` with `await this.auth.authorize(request, <need>)` and map the result; order stays authenticate → same-origin → parse. Keep `knowledge-admin`'s `guard` signature but make it async and `await` it at call sites.
- [ ] **Step 4: Run** the four suites, then `pnpm test:admin-auth`, `pnpm test:student-auth`, `pnpm typecheck`, `pnpm lint` → all pass.
- [ ] **Step 5: Commit** `feat(admin): require admin role for writes, viewer is read-only`

### Task 4: Provisioning script, retire `ADMIN_PASSWORD`, docs

**Files:**
- Create: `src/services/admin-user.service.ts`, `src/services/admin-user.service.test.ts`, `scripts/admin-user.ts`
- Modify: `package.json` (`admin:create`, `admin:reset`, add tests to `test:admin-auth`), `src/config/env.ts` (remove `ADMIN_USERNAME`, `ADMIN_PASSWORD`), `.env.example`, `README.md`, `docs/admin-workspace.md`, `docs/playground.md`, `ARCHITECTURE.md`, `output/prepare-knowledge-browser.ts`
- Create: `.scratch/users-rbac/issues/01-users-roles-admin-login.md`; modify `.scratch/README.md`

**Interfaces:**
- Produces: `AdminUserService#provision(email: string, role: "admin" | "viewer"): Promise<{ password: string | null }>` (new user → random password returned once; existing user → role added, password untouched, `password: null`); `#resetPassword(email): Promise<{ password: string }>` (throws `Error("User not found")` for unknown or non-admin users). Random password: 18 random bytes, base64url. CLI: `pnpm admin:create <email> [admin|viewer]` (default `admin`), `pnpm admin:reset <email>`; prints the password once and never logs it elsewhere.

- [ ] **Step 1: Write failing tests** for the service with a fake repository: lowercases email, rejects roles other than `admin`/`viewer`, stored hash verifies against the returned password, existing email adds the role without changing `passwordHash`, `resetPassword` unknown email throws.
- [ ] **Step 2: Run** `pnpm exec tsx --test src/services/admin-user.service.test.ts` → FAIL.
- [ ] **Step 3: Implement** the service, extend `AdminUserRepository` with `upsertWithRole` / `setPasswordHash`, add the thin CLI script and `package.json` scripts.
- [ ] **Step 4: Retire the env vars.** Remove `ADMIN_USERNAME`/`ADMIN_PASSWORD` from `env.ts`; update `.env.example`, README and docs (admin guide now describes `admin:create`, roles, viewer read-only, and "set `ADMIN_SESSION_SECRET` to enable the workspace"). Update `output/prepare-knowledge-browser.ts` to build a session for an existing admin id via `AdminAuthService` (inspect the file first; if it cannot work without a real user, make it read `ADMIN_EMAIL` and call `login` with a password the operator provides in the environment, and say so in the ticket).
- [ ] **Step 5: Rollout runbook** in the ticket and `docs/admin-workspace.md`, in this order: (1) `ADMIN_SESSION_SECRET` set in Vercel; (2) apply the migration to production with `pnpm db:migrate:deploy` against the production URL; (3) `pnpm admin:create <your email> admin` against the same database and store the printed password; (4) deploy; (5) confirm login, then delete `ADMIN_PASSWORD`/`ADMIN_USERNAME` from Vercel; (6) any student bound between steps 2 and 4 landed only in `student_accounts`: re-run the backfill `INSERT … SELECT … ON CONFLICT DO NOTHING` documented in the ticket. Note that deploying logs every admin out once and Vercel's production build runs the migration itself.
- [ ] **Step 6: Verify** `pnpm test:admin-auth && pnpm test:student-auth && pnpm typecheck && pnpm lint`, start `pnpm dev` against the isolated database, create an admin with the script, sign in at `/login`, confirm a viewer gets 403 on a ticket status update, and record limits in the ticket (no production run, no LINE check). `graphify update .`.
- [ ] **Step 7: Commit** `feat(admin-auth): provision admins by script and retire ADMIN_PASSWORD`

---

**Self-review:** goals map to tasks (schema/students → 1, login/sessions → 2, roles → 3, provisioning/retirement/runbook → 4). Every Review Focus line has a named test (items 1–2 Task 1, 3–5 Task 2, 6 Task 3, 7 Task 4). Names consistent across tasks: `AdminSession`, `AdminAuthService#authorize/getSession/login`, `AdminUserRepository#findByEmail/findActiveById`. Not planned (YAGNI, separate efforts): admin/role management UI, hiding write controls from viewers (they get 403), password change screen, contract migration dropping `student_accounts`, per-permission roles beyond admin/viewer.
