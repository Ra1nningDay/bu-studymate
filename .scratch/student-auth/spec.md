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
- Reverse link attack: someone sends `ยืนยันนักศึกษา` from their own LINE and passes the
  link to a real student; the student's bumail email then binds to the attacker's
  `lineUserId`, and the student is locked out (`email_taken`). There is no unbind and no
  LINE notification yet. Add an admin unbind and/or a LINE push naming the email before any
  feature trusts the binding; LINE Login closes it fully.
- Failures all redirect to the same `/login?student=failed` message and are not logged.
- Which app features require a verified student is decided for LINE only by the
  gate below; web `/chat` and `/student` are not gated.

## LINE gate (ticket [student-auth-02](issues/02-line-gate.md))

Defaults chosen 2026-10-24 (change here first if the product call differs):

- No feature flag: the app is not live, so the gate is always on whenever student auth is
  configured. If it is not configured the gate is skipped (nobody could verify).
- A LINE user with no `student_accounts` row gets a Flex card with a
  `createLinkUrl` button instead of any bot reply. This covers text messages, file uploads
  and the follow event. `ยืนยันนักศึกษา` keeps working and is never gated.
- The blocked message is not stored or replayed; the card says to resend after verifying.
- The card is sent at most once per 10 minutes per user (the link TTL); inside the window a
  one-line text reply points back to the card.
- Web `/chat` and group chats are out of scope.
- The reverse-link limit above matters more once the gate exists: ship the gate to real
  users only after an admin unbind or a LINE notice naming the bound email.
