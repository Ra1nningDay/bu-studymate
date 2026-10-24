# LINE Student Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A LINE user who has not bound a `@bumail.net` account gets a "verify first" card instead of any bot reply.

**Architecture:** `StudentAuthService` learns whether a `lineUserId` is verified (a `findByLineUserId` lookup through its repo). `LineWebhookController` checks it before the chat bot, the file handler and after the follow greeting, and replies with a new Flex card from `LineFlexPresenter`. Card spam is capped by reusing `RateLimitService.consume` with a 1-per-10-minutes window.

**Tech Stack:** Next.js 15 route handlers, Zod env, Prisma via existing repository, `node:test` via `tsx --test`.

**Spec:** [.scratch/student-auth/spec.md](../../../.scratch/student-auth/spec.md) (section "LINE gate"). Ticket: [student-auth-02](../../../.scratch/student-auth/issues/02-line-gate.md).

## Global Constraints

- No new dependencies; no `prisma` import in services or controllers; Flex JSON only in `src/presenters/`.
- No feature flag and no new env var: the gate is always on whenever `StudentAuthService.configured` is true (the app is not live yet, so there are no existing users to protect). When student auth is not configured the gate is skipped, since nobody could verify.
- `ยืนยันนักศึกษา` is never gated. Web `/chat` and group chats are untouched.
- Card cooldown: scope `"student_gate"`, one window `{ limit: 1, seconds: 600 }`.
- Copy (Thai, exact): card title `ยืนยันนักศึกษาก่อนใช้งาน`; body `ยืนยันบัญชี Google @bumail.net ของคุณกับ LINE ก่อน แล้วส่งข้อความมาใหม่อีกครั้งครับ`; button label `ยืนยันบัญชี`; altText `ยืนยันนักศึกษาก่อนใช้งาน`; repeats within the window reuse `createStudentLinkTemplate(url)` with a fresh link.
- Conventional Commits. Before finishing: `pnpm typecheck`, `pnpm lint`, `pnpm test:student-auth`, then `graphify update .`.

## Review Focus

- Auth unconfigured: the bot is still called, no card (Task 1).
- Linked user: bot is called, no card (Task 1).
- Unlinked user sends 3 messages in a row: exactly one card, then two compact buttons with fresh links, bot never called (Task 2).
- Unlinked user uploads a PDF: file is not downloaded or processed (Task 2).
- Unlinked user follows: greeting plus card; linked user following again: greeting only (Task 2).
- Repository lookup throws: webhook must not reply with bot output; the error propagates as it does for other DB failures (Task 2).

---

### Task 1: Verified check, verify card and text gate

**Files:**
- Modify: `src/services/student-auth.service.ts`, `src/presenters/line-flex.presenter.ts`, `src/controllers/line-webhook.controller.ts`
- Test: `src/services/student-auth.test.ts` (extend `flow()` and `lineFixture`)

**Interfaces:**
- Produces:
  - `Deps.repo` widened to `Pick<StudentAccountRepository, "bind" | "findByLineUserId">`
  - `StudentAuthService.isVerified(lineUserId: string): Promise<boolean>` (`(await repo.findByLineUserId(id)) !== null`)
  - `LineFlexPresenter.createStudentGateCard(url: string)`: Flex `bubble` envelope with `altText` and the Global Constraints copy and one green `uri` button to `url`.
  - private `LineWebhookController.replyIfNotVerified(replyToken: string, lineUserId: string): Promise<boolean>`: returns `false` when auth is unconfigured or the user is verified; otherwise replies (card when `consume` is allowed, else `createStudentLinkTemplate(url)`) and returns `true`, meaning the caller must stop.

- [ ] **Step 1: Write failing tests.** Update `flow()` so the repo also has `findByLineUserId: async () => null`. Extend `lineFixture(options: { linked?: boolean; configured?: boolean })`: `findByLineUserId` returns `{ lineUserId: "U1", email: "a@bumail.net" }` when `linked`; `configured: false` builds the service without secret; the rate-limit stub allows scope `"student_gate"` only on its first call and always allows other scopes. Tests asserting on `sent` and `botCalls`:
  - `unconfigured auth: unlinked user still reaches the bot, no card`
  - `unlinked: replies with the card and skips the bot` (`altText === "ยืนยันนักศึกษาก่อนใช้งาน"`, button uri starts with `${appUrl}/login?link=`, `botCalls` empty)
  - `linked: reaches the bot with no card`
  - `three messages: one card then two compact buttons with fresh links` (`sent` has 3 entries; first the card, others altText `ยืนยันนักศึกษา BU`)
  - `ยืนยันนักศึกษา still returns the link template for an unlinked user`
  - `repo throws: bot is not called` (`await assert.rejects(f.send("สวัสดี"))`, `botCalls` empty)
  - existing `other text still reaches the chat bot` must become `linked: true`.
- [ ] **Step 2: Run** `pnpm test:student-auth`. Expected: FAIL.
- [ ] **Step 3: Implement** `isVerified`, `createStudentGateCard`, `replyIfNotVerified`; call `if (await this.replyIfNotVerified(replyToken, lineUserId)) return;` in `handleTextMessage` after the `ยืนยันนักศึกษา` branch and before `showLineLoadingAnimation`.
- [ ] **Step 4: Run** `pnpm test:student-auth`. Expected: all PASS.
- [ ] **Step 5: Commit** `feat(student-auth): require student verification before the LINE bot answers`

### Task 2: Gate files and follow, then record evidence

**Files:**
- Modify: `src/controllers/line-webhook.controller.ts`, `.scratch/student-auth/issues/02-line-gate.md`, `.scratch/README.md`, `ARCHITECTURE.md` (LINE webhook section, only if it lists the student-link flow)
- Test: `src/services/student-auth.test.ts`

**Interfaces:**
- Consumes: `replyIfNotVerified` (Task 1).
- Produces: none.

- [ ] **Step 1: Write failing tests** with a `sendFile()` and `sendFollow()` helper on the fixture (`handleFileMessage` / `handleFollowEvent` with `message: { id: "m1", fileName: "a.pdf" }` and `replyToken: "r1"`): `unlinked file upload: card sent and getLineMessageContent not called` (assert the only fetch is the reply, no content fetch), `unlinked follow: greeting then card in one reply` (`sent[0].messages.length === 2`), `linked follow: greeting only`,  `unconfigured auth: follow is the greeting only`.
- [ ] **Step 2: Run** `pnpm test:student-auth`. Expected: FAIL.
- [ ] **Step 3: Gate `handleFileMessage`** right after its rate-limit check with the same guard as Task 1. **Gate `handleFollowEvent`**: when `studentAuth.configured` and not `isVerified`, reply `[greeting, createStudentGateCard(createLinkUrl(userId))]`; follow events carry `source.userId`; no cooldown here.
- [ ] **Step 4: Run** `pnpm test:student-auth`, `pnpm typecheck`, `pnpm lint`. Expected: all PASS.
- [ ] **Step 5: Update docs.** Ticket 02: status, criteria 1-5 mapped to tests, and under "Not done": real LINE check, no deployment, reverse-link limit still open. README row: replace the "Planned" row text with the real status. Keep the ticket `open` until a real LINE check passes.
- [ ] **Step 6: Run** `graphify update .`, then commit `feat(student-auth): gate LINE files and follow, record ticket evidence`
