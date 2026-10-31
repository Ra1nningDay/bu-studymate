# chat-structure-02: Separate routing, chat workflows and AI adapters

Type: refactor
Status: resolved
Updated: 2026-10-31
Blocked by: [chat-structure-01](01-structure-plan.md)

## Scope

Implement the ordered phases and ownership in the [plan](../plan.md) after the
user requests implementation. Claim this ticket before runtime edits and record
each phase's checks here. Re-read shared files changed by cost telemetry work.

## Acceptance Criteria

- [x] Existing offline behavioral baseline captured; missing branch coverage added before extraction.
- [x] Shared chat contracts and task-specific AI files extracted with public symbols preserved.
- [x] Guards/final routing and five workflows have the proposed owners; orchestrator retains turn lifecycle.
- [x] Extracted text uses presenters; existing services, DI, errors and streaming remain intact.
- [x] Domain import paths are explicit; static/dynamic callers, scripts and CI filters updated.
- [x] Explorer source labels, architecture/eval references and chat module README match implementation.
- [x] Behavioral matrix, complete offline suite, typecheck, lint and isolated build verified.
- [x] Graphify refreshed; remaining failures/limits recorded; index updated only against actual evidence.

## Verification

2026-10-31, local working tree only:

- Baseline: all 295 existing offline tests passed with synthetic credentials and
  an unreachable fixture database URL. Added 14 branch/usage/error regressions;
  all passed before extraction. Existing fixtures now accept study/ticket service
  injection without changing their default behavior.
- Extracted all 25 original AI declarations without changing their bodies or
  prompt strings; added exports only where shared helpers need them. Existing
  public AI exports remain in `src/lib/ai/index.ts`.
- Orchestrator reduced from the inspected 943 lines to 338 lines. Existing
  `asReply` moved to `chat-reply.ts`; the shared grounded-answer prompt/date
  helper moved to AI `context.ts`. These keep one implementation per helper.
- Before/after comparison: 116 controlled turns across Web/LINE matched provider
  requests, reply/Flex payloads, stream events, service/history calls, messages,
  runs, trace labels and token logs. Only random IDs/measured durations were
  excluded. Matrix covers all classifier intents, guards across three ticket
  states, knowledge miss/search/BU Links, abstention and workflow failure.
- Final all-`src` offline suite: 311 tests passed, 0 failed/skipped. This includes
  the concurrently completed cost-telemetry regressions; those changes remain
  owned by their original effort. Logs: `output/chat-structure/final-tests.log`.
- `pnpm typecheck` and `pnpm lint` passed independently on the final workspace.
- Root `pnpm db:generate` hit a locked Windows query-engine DLL (`EPERM`); no
  process was stopped. Generation against a copied schema with an isolated
  output succeeded. No schema migration or connected DB operation was performed.
- Full isolated application build exited 0 using the existing installed client:
  `node node_modules/next/dist/bin/next build .promptfoo/chat-structure-verified-build`.
  All routes compiled, static pages 24/24; no private env files copied, DB URL was
  synthetic, and the package production-migration hook was bypassed. The nested
  build emitted an ESLint plugin-resolution diagnostic; the independent root
  lint passed. Logs: `output/chat-structure/build.log`.
- An initial fixture containing a custom generated Prisma runtime caused NFT
  tracing to scan the Windows home folder and hit `My Documents` EPERM. A fresh
  source-only build fixture passed; no application source workaround was added.
- All new runtime files match the successful build snapshot. Checked 92 local
  Markdown links and absence of removed source paths. `git diff --check` passed.
- `graphify update .` passed: 1025 nodes / 1545 edges. `graphify explain` locates
  the new orchestrator and knowledge workflow; call ownership confirmed in source.

No fresh paid-provider, authenticated browser, live LINE or connected database
UAT, migration, private env change, commit, push or deployment. Existing golden
model quality, atomicity/cancellation/source-verification gaps remain outside
this behavior-preserving structural refactor. The pre-existing
`check:fresh-info` package entry points to a missing script; it was not run.

## Comments

2026-10-31: User authorized implementation. Claimed before runtime edits; using
the latest working-tree telemetry contracts and preserving unrelated changes.

2026-10-31: Created as planned follow-up. No application changes, live calls,
migration, private environment changes, commit, push or deployment performed.

2026-10-31: Resolved locally after extraction, complete offline checks, isolated
build, behavioral comparison and graph refresh. See the
[implemented ownership map](../../../src/services/chat/README.md) for navigation.

2026-10-31 publication follow-up: User authorized committing and pushing this
refactor to master. Publication is scoped to chat organization, import migration,
regressions and related documentation; benchmark/audit work remains separate.
The existing model-cost changes are already present in the master base.
The scoped staged source was checked in a detached publication worktree based
on `1493f62`: all 311 offline tests, typecheck and lint passed. Unrelated local
benchmark, audit and cost-documentation changes were excluded from staging.
