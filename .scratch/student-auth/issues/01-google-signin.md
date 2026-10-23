# student-auth-01: Bind a bumail.net Google account to a LINE user

Type: feature
Status: open (implemented locally; manual Google/LINE check pending)
Updated: 2026-10-23
Blocked by: none

## Scope

See [spec](../spec.md) and the [plan](../../../docs/superpowers/plans/2026-10-23-student-google-login.md).
No feature is gated on the student session yet, and LINE Login is not added.

## Acceptance criteria

1. `ยืนยันนักศึกษา` in LINE replies with a button to `<APP_URL>/login?link=<token>` (10 minutes).
2. `/login?link=…` shows "Sign in with Google" only for a valid token.
3. Callback accepts only `email_verified`, `hd` and the email domain equal to `bumail.net`, case-insensitive; spoofed domains rejected.
4. Success persists the binding (one email per LINE user and vice versa), sets the student cookie, `/student` shows the email.
5. Any failure redirects to `/login?student=failed` and writes nothing.
6. Scopes are `openid email` only.

## Evidence

- `pnpm test:student-auth`: 42 passed (signed tokens, OIDC client and domain table, repository conflicts with a fake client, service/controller flow with fake Google and repository, LINE trigger with stubbed `fetch`). Criteria 1, 3–6 are covered by these automated checks; criterion 2's page rendering and the real Google/LINE round trip are not.
- `pnpm typecheck` and `pnpm lint` passed.

## Not done

- Manual check with a real Google OAuth client and a bumail account, from a LINE message through to `/student`, plus a non-bumail account being rejected.
- `prisma/migrations/20261023000000_student_accounts` is not applied to any database (`pnpm db:migrate:deploy`).
- Login page rendering (valid link, failure banner) was not checked in a browser.
- No deployment, and `GOOGLE_*`/`STUDENT_AUTH_SECRET` are not set anywhere.
