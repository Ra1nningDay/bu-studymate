# Admin Login Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop using `ADMIN_PASSWORD` as the cookie-signing key and rate-limit admin login attempts.

**Architecture:** `AdminAuthService` gets a dedicated signing secret (`ADMIN_SESSION_SECRET`, falling back to the password so existing deployments keep working until it is set). `AdminAuthController.login` consumes the existing `RateLimitService` per client IP before checking credentials and answers 429 when over the limit.

**Tech Stack:** Next.js 15 route handlers, Zod env (`src/config/env.ts`), existing `RateLimitService`/`rate_limit_events` table, `node:test` via `tsx --test`.

**Spec:** none written. Scope agreed in chat 2026-10-24: option 1 only (separate secret + login rate limit). Per-admin DB users or Google admin login are **out of scope** (separate plan).

## Global Constraints

- Read config only through `env` from `@/src/config/env`; never `process.env` in app logic.
- `ADMIN_SESSION_SECRET`: `z.string().min(32).optional()` (same rule as `CRON_SECRET`).
- No new dependency and no schema/migration change (reuse `rate_limit_events`, scope string `"admin_login"`).
- Route files stay thin; no `prisma` import outside `src/repositories/`.
- Existing behavior preserved: password + optional username check, cookie name/flags, 8 h session, `/login?login=failed` redirect on bad credentials.
- Conventional Commits, ending with the session's Co-Authored-By line.

## Review Focus

- Wrong password never reveals more than before: over-limit gives 429 + `Retry-After` and **no cookie**, whether or not the password was right.
- `ADMIN_SESSION_SECRET` set but `ADMIN_PASSWORD` unset: login still impossible (`configured` stays false).
- Rate-limit store throws (database down): login still works (fail open) and the error is logged.
- `x-forwarded-for: "1.2.3.4, 5.6.7.8"` keys on `1.2.3.4`; header absent keys on `"unknown"` (shared bucket, still limited).
- Secret set, password rotated: existing cookies stay valid (documented, intended). Secret unset, password rotated: cookies invalid (current behavior kept).

---

### Task 1: Dedicated session secret

**Files:**
- Modify: `src/config/env.ts` (add `ADMIN_SESSION_SECRET` next to `ADMIN_PASSWORD`, line ~39)
- Modify: `src/services/admin-auth.service.ts`
- Modify: `.env.example`, `docs/admin-workspace.md`
- Test: `src/services/playground.test.ts` (auth tests live here, near line 59)

**Interfaces:**
- Produces: `new AdminAuthService(password?, username?, secret?: string)`; `secret` defaults to `env.ADMIN_SESSION_SECRET ?? password`. `sign()` uses `secret`; `configured` still means `Boolean(password)`.

- [ ] **Step 1: Write failing tests** (new tests beside "auth rejects absent config…", constructing services directly):
  - `session signing uses the dedicated secret, not the password` — `a = new Auth("pw", "admin", "s".repeat(32))`; token from `a`; `new Auth("pw", "admin", "t".repeat(32)).isAuthenticated(token) === false`; `new Auth("other-pw", "admin", "s".repeat(32)).isAuthenticated(token) === true`.
  - `without a secret the password still signs sessions` — `new Auth("pw")` token is rejected by `new Auth("other-pw")`.
  - `a secret alone does not enable login` — `new Auth(undefined, "admin", "s".repeat(32))`: `configured === false`, `createSession("x") === null`.
- [ ] **Step 2: Run** `pnpm exec tsx --test src/services/playground.test.ts` → the first test FAILS (token verifies under a different secret / sign ignores secret).
- [ ] **Step 3: Implement** the third constructor parameter and switch `sign()` to it; `createSession` and `isAuthenticated` otherwise unchanged. Add the env field.
- [ ] **Step 4: Run** the same command → all PASS (existing "password rotation" test still passes via the fallback).
- [ ] **Step 5: Docs.** `.env.example`: add `ADMIN_SESSION_SECRET=` under `ADMIN_PASSWORD` with comment "optional, 32+ chars (`openssl rand -hex 32`); when set, changing ADMIN_PASSWORD no longer logs admins out". Add the same two sentences to `docs/admin-workspace.md`.
- [ ] **Step 6: Commit** `feat(admin-auth): sign sessions with a dedicated secret`

### Task 2: Login rate limit

**Files:**
- Modify: `src/controllers/admin-auth.controller.ts`
- Modify: `src/services/playground.test.ts` (fixture at line ~56: pass an allowing limiter so existing `login` tests do not hit the database)
- Create: `.scratch/admin-auth/issues/01-session-secret-and-login-limit.md` (headings as in `.scratch/student-auth/issues/03-link-notice.md`)
- Modify: `.scratch/README.md` (one row), `docs/admin-workspace.md` (login limit sentence)

**Interfaces:**
- Consumes: `RateLimitService#consume({ lineUserId, scope, windows }): Promise<{ allowed: boolean; retryAfterSeconds?: number }>` (the `lineUserId` field carries the client key here).
- Produces: `export const adminLoginRateLimitConfig = { scope: "admin_login", windows: [{ limit: 10, seconds: 15 * 60 }, { limit: 30, seconds: 60 * 60 }] }` in `src/services/rate-limit.service.ts`; `new AdminAuthController(auth?, limits: Pick<RateLimitService, "consume"> = rateLimitService)`; `export function clientKey(request: Request): string` in the controller file (first `x-forwarded-for` entry, trimmed, else `"unknown"`).

- [ ] **Step 1: Write failing tests** (new `src/controllers/admin-auth.controller.test.ts`, fake `auth` and `limits`; add the file to `test:student-auth`'s sibling script `test:admin-auth` in `package.json`):
  - `clientKey takes the first forwarded address, else "unknown"` — covers `"1.2.3.4, 5.6.7.8"`, `" 9.9.9.9 "`, absent header.
  - `over the limit returns 429 with Retry-After and no cookie, even with the right password` — fake `consume` → `{ allowed: false, retryAfterSeconds: 120 }`, fake `createSession` counts calls; assert status 429, header `Retry-After: 120`, no `set-cookie`, `createSession` never called.
  - `allowed attempts keep the existing success and failure redirects` — `/admin` with cookie on a valid token, `/login?login=failed` otherwise; `consume` called with `scope: "admin_login"` and the forwarded IP as `lineUserId`.
  - `a failing limiter does not block login` — `consume` throws; valid credentials still get the cookie.
  - `cross-origin login is rejected before consuming the limit` — 403, `consume` not called.
- [ ] **Step 2: Run** `pnpm exec tsx --test src/controllers/admin-auth.controller.test.ts` → FAIL.
- [ ] **Step 3: Implement** the config constant, `clientKey`, the second constructor parameter, and the check in `login` after the origin check and before reading credentials: consume; on `{ allowed: false }` return `NextResponse.json({ error: "Too many attempts" }, { status: 429, headers: { "Retry-After": String(retryAfterSeconds ?? 60), "Cache-Control": "private, no-store" } })`; on a thrown error `console.error` and continue.
- [ ] **Step 4: Fix existing fixture** in `playground.test.ts` (`new AuthController(auth, { consume: async () => ({ allowed: true }) } as never)`); run `pnpm exec tsx --test src/controllers/admin-auth.controller.test.ts src/services/playground.test.ts src/services/admin-workspace.test.ts` → all PASS.
- [ ] **Step 5: Ticket, README row, docs sentence** ("login is limited to 10 attempts per 15 min and 30 per hour per client IP"). Ticket "Not done": per-IP only (rotating IPs bypasses; `shortcut:` comment in code), no lockout alerting, real Vercel IP header not verified, ADMIN_SESSION_SECRET not set in production.
- [ ] **Step 6: Run** `pnpm test:admin-auth && pnpm test:student-auth && pnpm typecheck && pnpm lint` → all pass; `graphify update .`.
- [ ] **Step 7: Commit** `feat(admin-auth): rate-limit admin login attempts per client IP`

---

**Self-review:** goals covered by Tasks 1–2; every Review Focus line has a named test (items 1, 3, 4 in Task 2; 2 and 5 in Task 1 — item 5's "secret set, password rotated" is the second assertion of the first Task 1 test). Names consistent: `adminLoginRateLimitConfig`, `clientKey`, `ADMIN_SESSION_SECRET`.
