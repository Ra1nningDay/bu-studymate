# student-auth-02: Require a verified student before the LINE bot answers

Type: feature
Status: open (implemented locally; real LINE check pending)
Updated: 2026-10-24
Blocked by: [student-auth-01](01-google-signin.md) manual Google/LINE check

## Scope

See the "LINE gate" section of the [spec](../spec.md) and the
[plan](../../../docs/superpowers/plans/2026-10-24-student-line-gate.md).
Web `/chat`, group chats and unbind/notification are not included.

## Acceptance criteria

1. An unlinked LINE user's text or file message gets the verify card and no bot reply, and nothing is written except the rate-limit event.
2. The card is sent once per 10 minutes per user; repeats get a compact button with a fresh link.
3. A linked user is answered normally; `ยืนยันนักศึกษา` works for everyone.
4. The follow event for an unlinked user sends the greeting and the card.
5. Student auth not configured: no gating.

## Evidence

- `pnpm test:student-auth`: 53 passed. New LINE gate tests (fake LINE `fetch`, repository and rate limiter): unlinked text gets the card and skips the bot (criterion 1), three messages give one card then two compact buttons with fresh links (2), linked user and `ยืนยันนักศึกษา` unaffected (3), file upload never downloaded and follow gets greeting plus card, linked follow greeting only (1, 4), unconfigured auth skips the gate (5), a failing lookup never reaches the bot.
- `pnpm typecheck` and `pnpm lint` passed.

## Not done

- Deferred review minors: gated messages still burn the normal text/file quotas; follow greeting depends on the lookup; follow card is outside the 10-minute window; no file/follow lookup-failure tests.

- Real LINE check: unlinked account sees the card, sign-in unlocks the bot. Card layout was not viewed in LINE.
- Deployment; blocked on student-auth-01 (migration, Google client, env).
- Reverse-link limit in the spec is still open; add admin unbind or a LINE notice before real users.
- Web `/chat` and group chats are not gated.
