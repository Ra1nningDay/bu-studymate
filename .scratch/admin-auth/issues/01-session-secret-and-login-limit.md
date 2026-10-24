# admin-auth-01: Separate session secret and login rate limit

Type: hardening
Status: open (implemented locally; production secret not set)
Updated: 2026-10-24
Blocked by: none

## Scope

Admin cookies are signed with `ADMIN_SESSION_SECRET` (32+ chars) instead of `ADMIN_PASSWORD`;
without it the password still signs, so existing deployments keep working. `login` is limited per
client IP (first `x-forwarded-for` entry) to 10 attempts / 15 min and 30 / hour using
`RateLimitService`, scope `admin_login`; over the limit returns 429 + `Retry-After` and no cookie.
Plan: [admin login hardening](../../../docs/superpowers/plans/2026-10-24-admin-login-hardening.md).

## Acceptance criteria

1. With a secret set, rotating `ADMIN_PASSWORD` keeps existing cookies valid; a different secret rejects them.
2. A secret alone does not enable login.
3. Over-limit login gets 429 and never sets a cookie or checks the password; limiter failure does not block login.

## Evidence

- `pnpm test:admin-auth`: 33 passed (fake limiter/auth). `pnpm typecheck` and `pnpm lint` passed.

## Not done

- `ADMIN_SESSION_SECRET` not set in production (setting it logs admins out once).
- Per-IP only (`shortcut:` in code); Vercel's real `x-forwarded-for` not verified; no alerting on lockouts.
- Per-admin DB users / Google admin login are a separate effort.
