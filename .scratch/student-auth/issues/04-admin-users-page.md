# student-auth-04: Admin Users page

Type: feature
Status: open (implemented locally; authenticated browser check pending)
Updated: 2026-10-24
Blocked by: none

## Scope

`/admin/users` table of verified students (`StudentAccount`): email, LINE user ID,
verified date, bot-run count, ticket count, last active. Email search via `?q=`, newest
first, capped at 200. Admins can delete a student (unbind: removes only the `StudentAccount` row; chat history, notes and tickets stay, the LINE gate blocks the student until they verify again). A dialog makes the admin type the email; the server re-checks it. Plan: [admin users page](../../../docs/superpowers/plans/2026-10-24-admin-users-page.md).

## Acceptance criteria

1. Page is admin-only and lists every verified student with correct counts.
2. `?q=` filters by case-insensitive email fragment; blank means all.
3. Students with no activity show `0` / `-`; empty result shows "No students."
4. Delete needs the exact email typed (case-insensitive) both in the dialog and on the server; wrong email, unknown id, unauthenticated and cross-origin requests delete nothing.

## Evidence

- `pnpm test:student-auth`: 66 passed (7 new: list, remove, controller; fake db). `pnpm typecheck` and `pnpm lint` passed.
- Dev server: `/admin/users` compiles; unauthenticated request redirects (307) to `/login`.

## Not done

- Authenticated visual check against real data (no admin login used), mobile layout check, deployment.
- No chat-message count or pagination. Delete does not erase the student's data or notify them on LINE; dialog not yet exercised in a browser.
