# users-rbac-01: Single users table, per-person admin login, admin/viewer roles

Type: feature
Status: open (migration applied to the connected Supabase DB 2026-10-24; code not deployed; no admin created there yet)
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

- Throwaway Postgres (pgvector/pgvector:pg16): old migrations, 3 seeded students (one mixed-case email), then the new migration: users 3 = student_accounts 3, 3 student roles, email lowercased. `admin:create` (new admin, new viewer, existing user gets role with password untouched), then `next dev` + curl: admin/viewer login 303 to /admin, wrong password and student-only 303 to failed, viewer GET knowledge 200 and POST 403, admin POST 400 (validation), no cookie 401.
- Connected Supabase DB: only this migration was pending; `migrate deploy` applied it; users 0 = student_accounts 0, roles student/admin/viewer present.

## Not done / limits

- Student bind/unlink against a real DB and the Supabase backfill with real rows are unchecked (the Supabase table was empty). No browser UI check, no LINE check, code not deployed.
- `output/prepare-knowledge-browser.ts` (git-ignored) now reads `ADMIN_EMAIL` + `ADMIN_PASSWORD` from the shell and logs in.
- No user-management UI or contract migration dropping `student_accounts`. Header identity and `/admin/profile` password change added afterwards (85 admin-auth tests; throwaway DB: wrong/short/mismatch/ok outcomes, old password rejected, new one accepted, 401 without cookie, full-width layout checked in the browser). Changing a password does not revoke other sessions.
- An existing user with no password who is given a role by `admin:create` receives a generated password (ruling).

## Rollout runbook

See [admin workspace guide](../../../docs/admin-workspace.md#rollout-runbook).
