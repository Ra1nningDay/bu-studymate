# student-auth-04: Admin Users page

Type: feature
Status: open (implemented locally; authenticated browser check pending)
Updated: 2026-10-24
Blocked by: none

## Scope

Read-only `/admin/users` table of verified students (`StudentAccount`): email, LINE user ID,
verified date, bot-run count, ticket count, last active. Email search via `?q=`, newest
first, capped at 200. Plan: [admin users page](../../../docs/superpowers/plans/2026-10-24-admin-users-page.md).

## Acceptance criteria

1. Page is admin-only and lists every verified student with correct counts.
2. `?q=` filters by case-insensitive email fragment; blank means all.
3. Students with no activity show `0` / `-`; empty result shows "No students."

## Evidence

- `pnpm test:student-auth`: 61 passed (4 new repository tests, fake db). `pnpm typecheck` and `pnpm lint` passed.
- Dev server: `/admin/users` compiles; unauthenticated request redirects (307) to `/login`.

## Not done

- Authenticated visual check against real data (no admin login used), mobile layout check, deployment.
- No chat-message count, pagination, or unbind/delete (deliberately out of scope).
