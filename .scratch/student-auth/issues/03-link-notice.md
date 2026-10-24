# student-auth-03: Tell the LINE user when their account is bound

Type: feature
Status: open (implemented locally; real LINE check pending)
Updated: 2026-10-24
Blocked by: none (branch stacks on `feat/student-login-page`)

## Scope

After a new binding, push one text message to that `lineUserId` with the masked email
(`s****@bumail.net`). Re-binding the same pair, rejected sign-ins and push failures send
nothing or never undo the sign-in. This helps only the forwarded-link case in the
[spec](../spec.md) known limits; the reverse-link attack still notifies the attacker's LINE, not the student.

## Acceptance criteria

1. A new binding pushes exactly one message to the bound `lineUserId`, with the email masked.
2. `unchanged` re-binding and rejected sign-ins push nothing.
3. A failing push is logged and the student is still signed in.

## Evidence

- `pnpm test:student-auth`: 57 passed (fake push function). `pnpm typecheck` and `pnpm lint` passed.

## Not done

- Real LINE push (uses `/v2/bot/message/push`, counts against the plan's push quota).
- Admin unbind and the reverse-link limit are still open.
