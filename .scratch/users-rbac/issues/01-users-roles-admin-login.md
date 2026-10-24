# users-rbac-01: Single users table, per-person admin login, admin/viewer roles

Type: feature
Status: open (implemented locally; migration unapplied, not deployed)
Updated: 2026-10-24
Blocked by: none (builds on branch `feat/admin-login-hardening`)

## Scope

`users` + `roles` + `user_roles` replace the shared `ADMIN_PASSWORD`. Students (Google/LINE) and admins share
one table; `StudentAccountRepository` reads `users` (role `student`), `student_accounts` is deprecated and kept
one release. Admin login is email + scrypt password; the cookie holds only user id + expiry and each request
re-reads user and roles. `admin` can write, `viewer` is read-only (403 on every write). `pnpm admin:create`
and `pnpm admin:reset` provision accounts. `ADMIN_USERNAME`/`ADMIN_PASSWORD` are removed.
Plan: [users + RBAC](../../../docs/superpowers/plans/2026-10-24-users-rbac.md).

## Acceptance criteria

1. Student sign-in on an admin's email attaches LINE + `student` only; deleting that student keeps the admin.
2. Unknown email, wrong password, disabled user and student-only user all fail identically.
3. Disabling a user or removing a role takes effect on the next request with an old cookie.
4. Viewer reads succeed; every write endpoint returns 403 before any work.
5. `admin:create` on an existing email adds the role without resetting its password.

## Evidence

- `pnpm test:admin-auth`: 78 passed, `pnpm test:student-auth`: 66 passed (fake repositories/db); `pnpm typecheck`, `pnpm lint` passed.

## Not done / limits

- Migration `20261024120000_users_roles` was **not applied to any database** (no isolated DB available; Docker daemon was off). The backfill SQL and the real Prisma queries in `AdminUserRepository`/`StudentAccountRepository` are unexecuted. Apply to an isolated DB and compare `count(users)` with `count(student_accounts)` before production.
- No `pnpm dev` login check, no viewer 403 check in a browser, no LINE check, no production run.
- `output/prepare-knowledge-browser.ts` (git-ignored) now reads `ADMIN_EMAIL` + `ADMIN_PASSWORD` from the shell and logs in.
- No user-management UI, password change screen, or contract migration dropping `student_accounts`.
- An existing user with no password who is given a role by `admin:create` receives a generated password (ruling).

## Rollout runbook

See [admin workspace guide](../../../docs/admin-workspace.md#rollout-runbook).
