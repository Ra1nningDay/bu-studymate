# admin-01: Unified Login, Navigation and Overview

Type: feature
Status: resolved
Updated: 2026-10-12
Blocked by: none

## Scope

Implement the [workspace spec](../spec.md). No migration, external identity
provider, paid model evaluation, commit, push or deployment.

## Acceptance Criteria

- [x] One login protects every admin page/report and web/admin mutation API.
- [x] No password in URLs, hidden ticket forms or legacy header bypass.
- [x] Root/chat/Playground redirects and shared responsive sidebar/header work.
- [x] Web Chat keeps saved sessions, traces/reports and lesson uploads.
- [x] Overview uses real aggregates and honest missing/error states.
- [x] Auth, aggregates, existing chat and browser regressions pass.
- [x] Typecheck, lint, docs and AST graph refresh pass.

## Verification

- Final `pnpm exec tsx --test src/services/admin-workspace.test.ts src/services/playground.test.ts lib/concise-chat.test.ts`: 42 passed, no failures.
- `pnpm typecheck`, `pnpm lint`, `graphify update .`: passed. Graph refresh used AST extraction with no model call.
- Real Next routes/rendering with isolated memory Prisma fixture: root/legacy/admin/report redirects; private APIs return 401; no database calls before login; shared login and logout; rejected bad password; desktop 1600px and mobile 390px; correct synthetic metrics; clean chart hydration; drawer open/close; shared static-guide send and resumed session; protected printable report; ticket status update reflected in Overview; Bot Runs retains shared auth and clean URLs.
- Upload UI failure/success used a response stub. The controller regression checks upload-first session creation and identity before a stubbed file save. Real document extraction/OCR and paid-model ingestion were not run.
- Read-only Overview service query against the configured PostgreSQL database succeeded: 7 day buckets, 1 distinct conversation identity, 1 run, 0 open tickets and 12 knowledge items at that check. This proves aggregate query execution, not a full real-provider/operational UAT.
- Existing `http://localhost:3000/` redirected to the shared login (200 after redirects), with password form configured. No environment file was changed by this task.
- Screenshots: `output/playwright/admin-overview-desktop.png`, `admin-overview-mobile.png`, `admin-chat-desktop.png`, `admin-chat-mobile.png`.
- Fixture server stopped; generated temporary build/types configuration was removed from the workspace and the pre-test TypeScript configuration restored.

No schema migration, paid-model call, real ticket mutation, commit, push or deployment was issued by this task. Browser mutations used memory persistence only.

## Comments

2026-10-12: Claimed after the user authorized the proposed unified admin routing
and supplied the green dashboard reference. Preserve other dirty work.

2026-10-12: Resolved after local checks. Reused the signed-cookie implementation
as shared admin auth, retained old URL redirects and consolidated the web tester.
Browser tests caught an SVG title hydration mismatch; a single text value fixed
it and the clean-hydration reload check passed. Concurrent Bot Runs and later
Web Chat reference work are owned by admin-02/admin-03 and were preserved.
