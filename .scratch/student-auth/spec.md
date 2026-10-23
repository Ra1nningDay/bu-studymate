# Student Google Sign-in (bumail.net) Spec

Status: implemented locally, manual Google/LINE check pending ([ticket](issues/01-google-signin.md)). Plan: [../../docs/superpowers/plans/2026-10-23-student-google-login.md](../../docs/superpowers/plans/2026-10-23-student-google-login.md)

## Goal

A student taps a link in the LINE chat, lands on the website login page, signs in
with their Bangkok University Google account, and the website records that this
LINE user (`lineUserId`) belongs to that `@bumail.net` email.

## Decisions (from discussion 2026-10-23)

- `bumail.net` mail is Google Workspace (MX → `aspmx.l.google.com`), so Google
  OAuth2 / OpenID Connect proves the email. No OTP, no LINE Login channel.
- Reject any account whose verified email domain is not exactly `bumail.net`.
  Enforcement is server-side from the Google ID token, never from client input.
- The LINE link carries a short-lived signed token holding the `lineUserId`; that
  is the only source of the LINE identity.
- One `lineUserId` binds to one email and one email to one `lineUserId`.

## Requirements

1. Sending `ยืนยันนักศึกษา` in LINE replies with a button opening
   `<APP_URL>/login?link=<signed token>` (token valid 10 minutes).
2. `/login?link=…` shows a "Sign in with Google" button when the token is valid.
3. Google callback accepts only: `email_verified === true`, `hd === bumail.net`,
   and the email domain (after the single `@`) equal to `bumail.net`, case-insensitive.
4. On success: persist the binding, set an HttpOnly student session cookie, and
   show `/student` with the bound email.
5. On any failure: redirect to `/login?student=failed` with no binding written.
6. Scopes are `openid email` only.

## Known limits

- A forwarded, unused link lets its holder bind a bumail email to the original
  LINE user. Mitigations: 10-minute expiry, one binding per LINE user and per email.
  Adding LINE Login would close this; deferred.
- Which app features require a verified student is not decided; this work only
  creates the binding and the session.
