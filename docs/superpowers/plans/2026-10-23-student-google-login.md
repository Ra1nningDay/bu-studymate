# Student Google Sign-in (bumail.net) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A student opens a link from the LINE chat, signs in with their `@bumail.net` Google account, and the site binds that email to their `lineUserId`.

**Architecture:** Hand-rolled OpenID Connect against Google (no new dependency). The LINE link carries an HMAC-signed token with the `lineUserId`; an HMAC-signed state cookie carries it through the Google round trip; the callback trusts the ID token Google returns over TLS from its token endpoint (OIDC Core §3.1.3.7) after checking `iss`, `aud`, `exp`, `nonce`, `email_verified`, `hd`, and the email domain. Binding lives in a new `student_accounts` table behind a repository.

**Tech Stack:** Next.js 15 route handlers, `node:crypto`, `fetch`, Prisma, Zod env, `node:test` via `tsx --test`.

**Spec:** [.scratch/student-auth/spec.md](../../../.scratch/student-auth/spec.md)

## Global Constraints

- No new dependencies; use `node:crypto` and global `fetch`.
- Never read `process.env` in app logic; add vars to `src/config/env.ts` and `.env.example`.
- `app/api/**/route.ts` stays 3-7 lines and delegates to a controller.
- No `prisma` import outside `src/repositories/`; no Flex/templates inside services (use `src/presenters/`).
- Student domain is exactly `bumail.net` (`STUDENT_EMAIL_DOMAIN`, default `bumail.net`); Google scopes are exactly `openid email`.
- Cookies: `studymate-student-oauth` (state) and `studymate-student` (session), both `httpOnly`, `sameSite: "lax"` (strict would not be sent on the redirect back from Google), `secure` in production, `path: "/"`.
- Link token TTL 10 min, state cookie TTL 10 min, session TTL 8 h (same as `adminSessionSeconds`).
- File names `kebab-case.ts`; Conventional Commits; never commit secrets.
- Before finishing: `pnpm typecheck`, `pnpm lint`, `pnpm test:student-auth`, then `graphify update .`.

## Review Focus

- Domain spoofing: `a@evilbumail.net`, `a@bumail.net.evil.com`, `a@evil.com@bumail.net` must be rejected; `Name@BUmail.NET` accepted and stored lowercase (Task 2).
- Unverified or foreign Google accounts: `email_verified: false`, missing/other `hd`, wrong `aud`, expired token, wrong `nonce` must all be rejected (Tasks 2, 4).
- Token misuse: tampered, expired, or wrong-`typ` tokens (a session token presented as a link token, etc.) must verify as `null` (Task 1).
- Binding conflicts: same email from a second LINE user, or same LINE user trying a second email, must be refused and leave the first binding intact; re-binding the same pair succeeds idempotently (Tasks 3, 4).
- Callback robustness: Google `?error=access_denied`, missing `code`/`state`, or missing state cookie must redirect to `/login?student=failed` without throwing (Task 4).

---

### Task 1: Config and signed tokens

**Files:**
- Modify: `src/config/env.ts` (Admin & App URL block), `.env.example`, `package.json` (script `test:student-auth`)
- Create: `src/services/signed-token.ts`
- Test: `src/services/student-auth.test.ts`

**Interfaces:**
- Produces:
  - env: `GOOGLE_CLIENT_ID?: string`, `GOOGLE_CLIENT_SECRET?: string`, `STUDENT_AUTH_SECRET?: string` (`z.string().min(32)`), `STUDENT_EMAIL_DOMAIN: string` (default `"bumail.net"`)
  - `signToken(payload: { typ: string } & Record<string, unknown>, secret: string, ttlSeconds: number, now?: number): string`
  - `verifyToken<T extends { typ: string }>(token: string | undefined, secret: string, typ: T["typ"], now?: number): T | null`

- [ ] **Step 1: Write failing tests** in `student-auth.test.ts` (same `before` dynamic-import pattern and `DATABASE_URL` fixture as `playground.test.ts`): `signed token round-trips`, `rejects tampered payload`, `rejects tampered signature`, `rejects expired token (now > exp)`, `rejects wrong typ`, `rejects wrong secret`, `rejects undefined / malformed input`.
- [ ] **Step 2: Add script** `"test:student-auth": "tsx --test src/services/student-auth.test.ts lib/google-oidc.test.ts"`; run `pnpm test:student-auth`. Expected: FAIL (module not found).
- [ ] **Step 3: Add the four env vars** to `envSchema` and `.env.example` (categorized under a "Student sign-in" comment; no real values).
- [ ] **Step 4: Implement `signToken`/`verifyToken`** in `src/services/signed-token.ts`: token is `base64url(JSON {…payload, exp: now+ttl*1000}) + "." + base64url(HMAC-SHA256)`; compare with `timingSafeEqual` after length check; any parse error returns `null`.
- [ ] **Step 5: Run** `pnpm test:student-auth` (google-oidc test file may not exist yet; create an empty `lib/google-oidc.test.ts` with a single `test("placeholder", () => {})` removed in Task 2). Expected: Task 1 tests PASS.
- [ ] **Step 6: Commit** `feat(student-auth): add signed token helper and env config`

### Task 2: Google OIDC client

**Files:**
- Create: `lib/google-oidc.ts`
- Test: `lib/google-oidc.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces:
  - `type GoogleIdClaims = { iss: string; aud: string; exp: number; nonce?: string; email?: string; email_verified?: boolean; hd?: string }`
  - `googleAuthUrl(p: { clientId: string; redirectUri: string; state: string; nonce: string; hd: string }): string` — `https://accounts.google.com/o/oauth2/v2/auth` with `response_type=code`, `scope=openid email`, `prompt=select_account`, plus the params.
  - `exchangeGoogleCode(p: { code: string; clientId: string; clientSecret: string; redirectUri: string; fetchImpl?: typeof fetch; now?: number }): Promise<GoogleIdClaims>` — POST `https://oauth2.googleapis.com/token` (form-encoded, `grant_type=authorization_code`); throws `Error` on non-2xx, missing `id_token`, `iss` not `accounts.google.com`/`https://accounts.google.com`, `aud !== clientId`, or `exp*1000 <= now`.
  - `bumailEmail(claims: GoogleIdClaims, domain: string): string | null` — lowercased email only if `email_verified === true`, `hd === domain`, exactly one `@`, and the part after it equals `domain` (case-insensitive); else `null`.

- [ ] **Step 1: Write failing tests** (replace the placeholder): `googleAuthUrl contains scope "openid email", hd, state, nonce`; `bumailEmail` table test covering the Review Focus domain-spoof cases, unverified, missing/other `hd`, and `Name@BUmail.NET → name@bumail.net`; `exchangeGoogleCode` with a fake `fetchImpl` returning a JWT (build `header.payload.sig` with base64url payload) for: happy path, wrong `aud`, wrong `iss`, expired, non-2xx, missing `id_token`. Assert the POST body contains `code` and `redirect_uri`.
- [ ] **Step 2: Run** `pnpm test:student-auth`. Expected: FAIL.
- [ ] **Step 3: Implement** the three functions. Decode the JWT payload without verifying the signature, with a code comment citing that the token came directly from Google's token endpoint over TLS.
- [ ] **Step 4: Run** `pnpm test:student-auth`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(student-auth): add Google OIDC client and bumail domain check`

### Task 3: Persistence

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20261023000000_student_accounts/migration.sql`, `src/repositories/student-account.repository.ts`
- Test: `src/services/student-auth.test.ts` (repository tested with a fake `prisma`-shaped client, same style as the existing repository-with-fake tests in `playground.test.ts`)

**Interfaces:**
- Produces:
  - model `StudentAccount` → table `student_accounts`: `id` uuid default `gen_random_uuid()`, `lineUserId String @unique @map("line_user_id")`, `email String @unique`, `verifiedAt DateTime @default(now()) @map("verified_at") @db.Timestamptz(6)`
  - `type BindResult = "bound" | "unchanged" | "line_taken" | "email_taken"`
  - `class StudentAccountRepository { bind(input: { lineUserId: string; email: string }): Promise<BindResult>; findByLineUserId(lineUserId: string): Promise<{ lineUserId: string; email: string } | null> }`

- [ ] **Step 1: Write failing tests**: `bind new pair → "bound"`, `same pair again → "unchanged"`, `same email other LINE → "email_taken"`, `same LINE other email → "line_taken"`, and that conflicts write nothing.
- [ ] **Step 2: Run** `pnpm test:student-auth`. Expected: FAIL.
- [ ] **Step 3: Add the model and hand-write the additive migration SQL** (create table + two unique indexes), following the style of `20261013000000_hybrid_knowledge`; run `pnpm db:generate`.
- [ ] **Step 4: Implement the repository.** `bind` runs in `prisma.$transaction`: look up by `lineUserId` and by `email`, decide the result, create only on `"bound"`. Constructor takes an optional client param (default `prisma`) so tests inject a fake.
- [ ] **Step 5: Run** `pnpm test:student-auth` and `pnpm typecheck`. Expected: PASS.
- [ ] **Step 6: Commit** `feat(student-auth): add student account table and repository`

### Task 4: Service, controller, routes

**Files:**
- Create: `src/services/student-auth.service.ts`, `src/controllers/student-auth.controller.ts`, `app/api/student/auth/google/start/route.ts`, `app/api/student/auth/google/callback/route.ts`
- Test: `src/services/student-auth.test.ts`

**Interfaces:**
- Consumes: `signToken`, `verifyToken` (Task 1); `googleAuthUrl`, `exchangeGoogleCode`, `bumailEmail` (Task 2); `StudentAccountRepository.bind` (Task 3).
- Produces:
  - `studentCookieName = "studymate-student"`, `studentOauthCookieName = "studymate-student-oauth"`, `studentSessionSeconds = 8*60*60`
  - `class StudentAuthService` (constructor takes a deps object `{ secret, clientId, clientSecret, domain, appUrl, repo, google }` defaulting from `env`/real modules so tests inject fakes):
    - `createLinkUrl(lineUserId: string, now?: number): string` → `${appUrl}/login?link=<token typ "link">`
    - `isValidLink(token: string | undefined, now?: number): boolean`
    - `startGoogleSignIn(linkToken: string | undefined, now?: number): { redirectUrl: string; stateCookie: string } | null` — `null` if link invalid or service unconfigured; stateCookie is a signed `typ "oauth"` token holding `{ lineUserId, state, nonce }`
    - `completeGoogleSignIn(p: { code?: string; state?: string; error?: string; stateCookie?: string }, now?: number): Promise<{ ok: true; sessionToken: string; email: string } | { ok: false; reason: string }>` — checks `error` absent, params present, `state` equals cookie's, `nonce` equals claims', `bumailEmail` non-null, `bind` result in `bound | unchanged`; never throws (wrap `exchangeGoogleCode` failure as `{ ok:false }`)
    - `readSession(token: string | undefined, now?: number): { lineUserId: string; email: string } | null`
  - `class StudentAuthController { start(request: Request): Promise<Response>; callback(request: Request): Promise<Response> }` and exported `studentAuthController`. `start` reads `?t=`, on success redirects 302 to Google and sets the state cookie; on failure redirects to `/login?student=failed`. `callback` clears the state cookie, on success sets the session cookie and redirects 303 to `/student`, on failure redirects 303 to `/login?student=failed`. Redirect origin via `getPublicOrigin` from `admin-auth.controller`; responses carry `Cache-Control: private, no-store`.
  - Redirect URI sent to Google: `${appUrl}/api/student/auth/google/callback`.

- [ ] **Step 1: Write failing tests** (service with fake repo and fake `google`): happy path returns `ok` and a readable session; wrong `state`; state cookie missing/tampered/expired; `error=access_denied`; missing `code`; nonce mismatch; non-bumail email; `email_taken` and `line_taken` → `ok:false`; `startGoogleSignIn` with tampered link → `null`; `readSession` rejects an `oauth`-typed token. Controller tests: `start` redirects to `accounts.google.com` and sets `studymate-student-oauth` with `SameSite=lax`; `callback` success sets `studymate-student` and redirects to `/student`; `callback` failure redirects to `/login?student=failed` and sets no session cookie.
- [ ] **Step 2: Run** `pnpm test:student-auth`. Expected: FAIL.
- [ ] **Step 3: Implement service and controller.** `state`/`nonce` from `randomBytes(16).toString("hex")`.
- [ ] **Step 4: Add the two route files** (`runtime = "nodejs"`, `export async function GET(request: Request) { return studentAuthController.start(request); }` and `.callback`).
- [ ] **Step 5: Run** `pnpm test:student-auth`, `pnpm typecheck`, `pnpm lint`. Expected: PASS.
- [ ] **Step 6: Commit** `feat(student-auth): add Google sign-in flow and routes`

### Task 5: LINE trigger and pages

**Files:**
- Modify: `src/presenters/line-flex.presenter.ts`, `src/controllers/line-webhook.controller.ts` (text-message path, before `createBotReply`), `app/login/page.tsx`
- Create: `app/student/page.tsx`
- Test: `src/services/student-auth.test.ts` (LINE controller case only)

**Interfaces:**
- Consumes: `studentAuthService.createLinkUrl`, `isValidLink`, `readSession`, `studentCookieName` (Task 4).
- Produces: `LineFlexPresenter.createStudentLinkTemplate(url: string)` returning a `buttons` template with one `uri` action labeled `เข้าสู่ระบบด้วย Google` and `altText` `ยืนยันนักศึกษา BU`.

- [ ] **Step 1: Write failing test:** the LINE webhook controller, given the text `ยืนยันนักศึกษา` (also with surrounding spaces), calls `replyLineMessage` with the template whose URI starts with `<appUrl>/login?link=`, and does not call `createBotReply`; any other text still reaches `createBotReply`. Inject `studentAuth` via the controller's existing constructor-deps pattern.
- [ ] **Step 2: Run** `pnpm test:student-auth`. Expected: FAIL.
- [ ] **Step 3: Implement** the presenter method and the controller branch (trim, exact match).
- [ ] **Step 4: Login page:** read `searchParams.link` and `student`; when `isValidLink` is true render a "Sign in with Google" anchor to `/api/student/auth/google/start?t=<link>` above/below the admin form without changing the admin form; when `student=failed` show `ต้องใช้อีเมล @bumail.net และเปิดลิงก์จากแชท LINE อีกครั้ง`; when neither, render the page exactly as today. Follow `DESIGN.md` for styling.
- [ ] **Step 5: `/student` page** (`dynamic = "force-dynamic"`): `readSession` from the cookie; no session → `redirect("/login")`; else show the bound email and a line that the account is linked.
- [ ] **Step 6: Run** `pnpm test:student-auth`, `pnpm typecheck`, `pnpm lint`. Expected: PASS.
- [ ] **Step 7: Manual check** (not automatable here): with a real Google OAuth client and a bumail account, send `ยืนยันนักศึกษา` in LINE, complete sign-in, confirm `/student`; repeat with a non-bumail Google account and confirm rejection. Record result in the ticket.
- [ ] **Step 8: Commit** `feat(student-auth): add LINE link trigger, login button and student page`

### Task 6: Docs and ticket

**Files:**
- Modify: `ARCHITECTURE.md` (auth/integrations section), `.scratch/README.md` (add effort row, status "implemented locally" only if Task 5 Step 7 was done, else "implemented, manual Google check pending"), `.scratch/student-auth/spec.md` (status line)
- Create: `.scratch/student-auth/issues/01-google-signin.md` (acceptance criteria = spec Requirements 1-6, evidence = commands run and Step 7 outcome)

- [ ] **Step 1: Write the ticket and update docs/index.** Document the Google Cloud setup: OAuth client type Web, redirect URI `<APP_URL>/api/student/auth/google/callback`, env vars from Task 1.
- [ ] **Step 2: Run** `graphify update .`.
- [ ] **Step 3: Commit** `docs(student-auth): document Google sign-in flow and ticket evidence`
