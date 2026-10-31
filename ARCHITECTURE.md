# BU StudyMate Architecture

Source inspected: 2026-10-27, current working tree.
Status: source map of an existing application, including uncommitted changes.
Playground local verification is recorded in [playground-01](.scratch/playground/issues/01-admin-playground.md).
Real database/provider UAT and deployment remain unverified by this work.

## Using This Document

Read for onboarding, source ownership, call paths or technical changes. Confirm
the affected source before editing: this snapshot includes work not yet committed.
[AGENTS.md](AGENTS.md) owns working rules, [DESIGN.md](DESIGN.md) owns presentation,
[CONTEXT.md](CONTEXT.md) owns terminology and [.scratch/README.md](.scratch/README.md)
owns work status. Specs/tickets describe intended changes and verification.
Record actual trade-offs under `architecture-decisions/` using
[domain guidance](docs/agents/domain.md); create ADRs only when needed.

## 1. Structure and Ownership

StudyMate is one Next.js App Router application with React, strict TypeScript,
PostgreSQL/Prisma, LINE integration and configured AI providers. Use
[package.json](package.json) and the lockfile for current versions and commands.

| Area | Owner / source entry | Responsibility |
|---|---|---|
| Admin Web Chat | [chat workspace](src/app/admin/chat/playground.tsx), [upload](src/app/admin/chat/study-upload.tsx), [SSE client](src/lib/chat-sse-client.ts) | Saved sessions, progressive SSE answer streaming, composer, traces/reports and lesson upload. |
| Admin Overview | [overview service](src/services/admin-overview.service.ts), [repository](src/repositories/admin-overview.repository.ts) | Seven Bangkok calendar days of actual identity/run aggregates and current ticket/knowledge counts. |
| HTTP entry points | [chat route](src/app/api/chat/route.ts), [LINE route](src/app/api/line/webhook/route.ts) | Delegate to controllers. |
| Request boundaries | [chat controller](src/controllers/chat.controller.ts), [LINE controller](src/controllers/line-webhook.controller.ts) | Parse/validate input, consume limits, handle channel delivery (JSON or opt-in SSE for web); LINE signature check. |
| Chat orchestration | [ChatOrchestrationService](src/services/chat-orchestration.service.ts) | Workflow guards, route selection, streaming callbacks, execution and parallel run/message linkage. |
| AI routing and answers | [agent router](src/lib/agent-router.ts), [AI adapter](src/lib/ai.ts), [OpenAI stream reader](src/lib/openai-stream.ts), [fresh information](src/lib/fresh-info.ts) | Configured model calls, SSE delta extraction and answer generation/retrieval. |
| Campus knowledge | [knowledge service](src/services/knowledge.service.ts), [query rewrite](src/lib/knowledge-query.ts), [rerank adapter](src/lib/knowledge-rerank.ts), [hybrid guide](docs/knowledge-rag.md) | Conditionally rewrite follow-ups using `OPENAI_QUERY_REWRITE_MODEL`, retrieve approved current candidates with keyword/vector RRF, rerank >5 candidates into five passages using `OPENAI_RERANK_MODEL`, generate from cited evidence (appending cited FAQ action links) and report misses. |
| BU Links live lookup | [client](src/lib/bulinks.ts), [service](src/services/bulinks.service.ts), [presenter](src/presenters/bulinks.presenter.ts), [guide](docs/bulinks-live-lookup.md) | Fresh-info and knowledge-miss questions try live BU Links announcements and service-page links first, with no LLM; a null result or error falls back to web search. |
| Study memory | [study service](src/services/study-memory.service.ts), [file ingestion](src/lib/study-file.ts) | Saved notes/materials, assignments, tutoring, file extraction/OCR. |
| Knowledge admin | [workspace](src/app/admin/knowledge/knowledge-workspace.tsx), [controller](src/controllers/knowledge-admin.controller.ts), [service](src/services/knowledge-admin.service.ts) | Authenticated search/pagination, evidence availability, reviewed add/edit and individual source checks through shared ingestion. |
| Admin Users | [page](src/app/admin/users/page.tsx), [repository](src/repositories/student-account.repository.ts) | Admin table of verified students with run/ticket counts, email search and delete (unbind) behind a type-the-email dialog ([controller](src/controllers/student-admin.controller.ts)). |
| Facility tickets | [ticket service](src/services/ticket.service.ts) | Draft/session workflow, confirmation, creation and status lookup. |
| Presentation | [web presenter](src/presenters/chat-response.presenter.ts), [SSE presenter](src/presenters/chat-stream.presenter.ts), [LINE presenter](src/presenters/line-flex.presenter.ts) | Channel response shaping and SSE frame encoding; LINE presenter wraps [Flex templates](src/lib/flex-messages.ts). |
| Persistence | `src/repositories/`, [schema](prisma/schema.prisma), [Prisma client](src/lib/prisma.ts) | Prisma-backed reads/writes and persisted contracts. |
| Configuration | [validated environment](src/config/env.ts) | Central application configuration; secret values stay outside documentation. |
| Admin Playground | [controller](src/controllers/playground.controller.ts), [service](src/services/playground.service.ts), [guide](docs/playground.md) | Saved web test sessions, run traces and printable reports; present in the working tree. |
| Evaluation | [eval guide](evals/README.md), [concise-chat checks](src/lib/concise-chat.test.ts), [latency/SSE checks](src/lib/chat-latency-sse.test.ts) | Synthetic regression checks and separately configured provider evaluations. |

The layered convention is route → controller → service → repository, with
presenters for channel output and `src/lib/` for adapters/facades. It is a maintenance
rule, not proof that every legacy file follows it: orchestration/controllers still
contain some text formatting, and older admin pages use their own auth checks.
Keep future changes scoped to the appropriate owner rather than restructuring
unrelated code while following this map.

## 2. Chat Request Path

```mermaid
flowchart TD
    Web[Web chat] --> Chat[Chat controller]
    LINE[LINE webhook] --> Hook[LINE controller]
    Chat --> Orch[Chat orchestration]
    Hook --> Orch
    Orch --> Route[Workflow guards and intent router]
    Route --> Knowledge[Campus knowledge]
    Route --> Fresh[Fresh information]
    Route --> Study[Study memory]
    Route --> Ticket[Ticket workflow]
    Route --> General[General Chat or boundary reply]
    Knowledge --> Repo[Repositories]
    Study --> Repo
    Ticket --> Repo
    Orch --> Logs[Message and run repository]
    Repo --> DB[(PostgreSQL)]
    Logs --> DB
    Knowledge --> AI[Configured AI adapters]
    Fresh --> AI
    General --> AI
```

`ChatController.handleWebChat` validates JSON through the DTO, normalizes the
browser session identity, applies rate limits and calls `createBotReply` with
channel `web`. The LINE controller verifies the request signature, extracts the
LINE identity, applies limits and sends text or the returned Flex payload.

`createBotReply` loads session and single-CTE completed history in parallel,
resolves workflow guards and the route (skipping the LLM router on ticket
hard-guards unless local safety-critical hints match), then loads bounded 8-turn
raw history (only for `ASK_BU_INFO` / `ASK_FRESH_INFO`) alongside parallel
user-message and run writes before executing the chosen branch. Post-execution
persistence stores the assistant reply and completion metadata in parallel, or
marks an existing run as failed. Errors before run creation may have no saved
run. Router labels/flags are stored observations; they are not independent proof
of external calls.

Web chat (`/api/chat`) and Playground (`/api/admin/playground/message`) return
complete JSON replies by default and stream opt-in SSE (`Accept: text/event-stream`
emitting `delta`, `reset`, `replace`, `done`, `error`) during final answer
generation. File uploads use a separate controller path and `saveStudyFile`;
they are not ordinary text-chat turns.

## 3. Data and Identity Boundaries

[prisma/schema.prisma](prisma/schema.prisma) owns the persisted shape:

- `KnowledgeItem`: campus content, keywords, canonical source, snapshot hash,
  reviewer and verification/review/validity dates; `sourceKind` PAGE (fetched and
  hash-checked) or FILE (imported file, never fetched) and per-item `actionLinks`.
  Legacy rows are unapproved.
- `KnowledgeChunk`: bounded passages, Thai/English full-text index and compatible
  pgvector embeddings. Repository filters evidence validity before keyword/vector
  ranking; up to 40 fused candidates reach the LLM rerank adapter
  (`OPENAI_RERANK_MODEL`, `max_completion_tokens: 2048`), which skips provider calls
  when `<= 5` candidates exist, selects at most five original passages otherwise,
  and falls back to RRF order on failure. Service supplies selected passages and
  validated source IDs to generation. With history, the query rewrite adapter
  (`OPENAI_QUERY_REWRITE_MODEL`, `max_completion_tokens: 1536`) resolves follow-ups
  before embedding/retrieval/rerank while skipping standalone questions without
  follow-up markers (`isStandaloneKnowledgeQuery`), falling back to the original
  query on failure. Generation retains the original question/history. Service
  counts rewrite/rerank usage and reports their status/models in the existing
  execution trace. New knowledge runs also retain measured stage durations, query
  changes, bounded candidate snapshots and before/selected ranks in existing run
  JSON. SQL supplies keyword/vector ranks; RRF shares the retrieval SQL duration.
  Playground validates these optional fields on read and Web Chat/report render
  expandable details. Old logs remain readable. An empty approved corpus skips all
  knowledge provider calls.
- `ChatSession` and `Ticket`: workflow state/drafts and facility records.
- `ChatMessage` and `BotRun`: conversation records and linked execution metadata.
- `Notebook`, `UserMemory`, `StudyMaterial`, `MaterialChunk`, `Assignment`: saved learning context.
- `RateLimitEvent`: request-limit persistence.
- `StudentAccount`: one verified `@bumail.net` email bound to one `lineUserId`
  (both unique). Written only by the Google sign-in callback; see
  [student-auth spec](.scratch/student-auth/spec.md).

The read-only `/admin/agent/workflow` page checks `requireAdmin()` before using
the existing `listBotRunReviews` read facade, date filters and pagination. It
does not execute workflows or call providers. The source-derived routing map is
separate from saved run evidence. Workflow, Bot Runs and Playground share
`presentExecutionLog` for validating legacy JSON, optional timings/status and
bounded RAG detail before rendering. The existing `KnowledgeTraceDetails`
component presents passage ranks, queries and literal evidence. Runs accepts
`view=trace` for direct evidence links; navigation retains filters/page/run.

Student sign-in: the LINE text `ยืนยันนักศึกษา` makes
[the webhook controller](src/controllers/line-webhook.controller.ts) reply with a
`/student/login?link=<signed token>` button (10 minutes, holds the `lineUserId`).
[student-auth.controller](src/controllers/student-auth.controller.ts) starts the Google
OpenID Connect flow and, in the callback, accepts only a Google ID token with
`email_verified`, `hd` and the email domain equal to `STUDENT_EMAIL_DOMAIN`
(default `bumail.net`) before binding and setting the `studymate-student` cookie
(lax, 8 hours). Tokens are HMAC-signed with `STUDENT_AUTH_SECRET`
([signed-token.ts](src/services/signed-token.ts)); Google calls live in
[src/lib/google-oidc.ts](src/lib/google-oidc.ts). Google Cloud setup: OAuth client type Web,
redirect URI `<APP_URL>/api/student/auth/google/callback`, env `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `STUDENT_AUTH_SECRET`. On LINE, text, file and follow events from a `lineUserId` with no `StudentAccount` get a
verify card instead of any bot reply (skipped when student auth is not configured); web `/chat`
is not gated.

Web session identifiers are normalized by [src/lib/web-session.ts](src/lib/web-session.ts).
They identify conversation context, not an authenticated BU student account.
LINE identity comes from the verified webhook event. Keep queries scoped to the
identity expected by each repository. Database migrations/seeding and provider
calls require their own environment and verification; source inspection does
not prove that a deployed database matches the schema.

## 4. Presentation, Admin and Integrations

Admin analytics share `src/lib/analytics-date-range.ts` for validated inclusive
Bangkok date windows (`from`/`to`, default seven days, max 366). Overview passes
the window into `AdminOverviewService`/`AdminOverviewRepository`; Runs applies it
to both list and count before pagination. Cost calls `AnalyticsCostService` →
`AnalyticsCostRepository` to aggregate token logs plus positive residual legacy
`BotRun.metadata.tokensUsed` totals. Linked log timestamps follow run creation;
unlinked usage follows log creation. Legacy usage lacks per-model input/output
splits and stays unpriced. Existing saved estimates are summed only for supported
models with token breakdowns; unsupported/fallback-priced logs stay unpriced.
The repository detects an absent additive log table and reads legacy totals
without mutations. Missing data, zero and read errors are distinct. Current
ticket/knowledge snapshots are independent of analytics dates. See
[analytics-dates-01](.scratch/analytics-dates/issues/01-real-usage-date-filters.md).

The same orchestrator serves authenticated admin Web Chat and LINE; delivery differs. Web
shows saved reply text, source links and per-turn metadata.
LINE uses templates/Flex messages through its controller/presenter. See
[DESIGN.md](DESIGN.md) for the UI baseline and intended interaction quality.

The admin workspace uses one signed cookie and web conversation identities;
see [auth service](src/services/admin-auth.service.ts), [admin guide](docs/admin-workspace.md) and
[Playground guide](docs/playground.md). It uses configured database/provider
connections and can make real operational writes. A separate conversation
identity does not make it a dry run.

Playground's message controller calls the shared orchestrator with `channel=web`;
the returned `runId` identifies the persisted turn. When `Accept: text/event-stream`
is sent, the controller streams progressive reply deltas and finishes with `done`
carrying `{ runId, reply, sources }` after DB persistence completes; otherwise it
returns JSON. Read paths use `PlaygroundService` → `PlaygroundRepository` → the
typed Playground presenter, scoped to validated `playground-<UUID>` sessions. The
client restores its selected session from tab storage and reloads saved
messages/runs. The report page reads those records afresh without invoking
orchestration. No schema change was introduced. Completed-turn inspection, auth,
report refresh and SSE streaming were verified with synthetic persistence; see
[playground-01](.scratch/playground/issues/01-admin-playground.md) and
[chat-latency-01](.scratch/chat-latency/issues/01-orchestration-rag-sse.md) for
checks and their boundaries.

`/login` authenticates via the shared auth controller; `/admin/layout.tsx` renders
the common sidebar/header. Data-reading pages additionally call `requireAdmin`
before queries, since layout rendering does not serialize child data access and
soft navigation does not re-render the shared layout. `requireAdmin` memoizes the
session lookup with React `cache()` per request only, so layout and page share one
user/role query without caching sessions across requests. `admin/loading.tsx`
is the route loading boundary for admin pages.
Ticket mutations, Playground APIs and legacy web chat/upload APIs check the same
cookie and same-origin writes. Missing configuration closes access. Password query
strings and the legacy header no longer authorize any admin surface. Root/old web
chat/Playground URLs redirect to the unified workspace. LINE signature checks remain
separate. See [admin-01](.scratch/admin-dashboard/issues/01-unified-workspace.md)
for scope, checks and evidence boundaries.

Admin sign-in is per person: `users` (students and admins together) with `roles`/`user_roles`
(`student`, `admin`, `viewer`). `AdminAuthService` verifies a scrypt password, issues a cookie holding only
user id and expiry, and re-reads user and roles on every request; `authorize(request, "read"|"write")`
returns ok/unauthenticated/forbidden (viewer reads, only admin writes). Provisioning is
`pnpm admin:create`/`admin:reset`. `StudentAccountRepository` now reads `users`; `student_accounts` is deprecated.

`/admin/knowledge` requires admin auth before loading its initial list. Its
`/api/admin/knowledge` read/save, `/source` snapshot and `/{id}/check` endpoints
use the same cookie, same-origin writes and strict DTO validation. Repository
search/count reads page through all documents, including unapproved legacy rows.
Availability explains current approval, validity, source and compatible-index
gates; it does not claim factual correctness. Admin saves reuse reviewed ingestion
and atomic document/chunk replacement. The repository verifies the selected
identity inside the transaction: creates reject title collisions and edits keep
the original title/ID. CLI manifests retain their existing upsert-by-title behavior.
Individual checks reuse the scheduled checker with an optional ID filter; they
do not renew review dates. No schema or retrieval-policy change was introduced.

The reference UI adds repository-backed corpus counts and category/status/source
filters before pagination. Counts use the approval, date, source, content
fingerprint and compatible passage gates; no processing history is inferred.
`GET /api/admin/knowledge/{id}` reads ordered indexed passages without vectors.
Detail tabs and article previews use stored text. Per-document usage/file metadata
is unavailable; question testing reuses Web Chat and saved Knowledge Base runs.

`POST /api/admin/knowledge/bulk` accepts 1–50 distinct, explicitly selected UUIDs
and their loaded `updatedAt` versions. Strict DTOs allow deletion or category/
keyword replacement only. Admin service prepares compatible passage embeddings
in batches of at most 32 before mutation; keyword-only updates reuse vectors.
Repository serializable transactions recheck selected versions, update metadata
and lexical/fingerprint/vector fields together, or delete selected articles with
cascading passages. Stale/missing records fail the whole batch. Stale/unindexed
evidence keeps an invalid fingerprint and cannot be promoted by metadata edits.
Text, sources and approval/validity dates are preserved; no schema was added.

Overview counts/aggregates run in `AdminOverviewRepository`, including parameterized
SQL for distinct message identities and daily Bangkok buckets. `src/lib/prisma.ts`
wires `@prisma/adapter-pg` (`pg` pool `max: 5`, stripping Prisma-only `pgbouncer`
URL flags) so every query over Supabase's transaction pooler executes in a single
network round-trip without prepared-statement collisions. The service fills
the range series, derives run success/intent percentages, and caches global
corpus counts (`knowledge_items`, `study_materials`, `material_chunks`) via
`unstable_cache` (60s TTL, tag `admin-overview-counts`, invalidated on knowledge
and study-material writes). `/admin` wraps the overview body and Knowledge
Snapshot panel in `<Suspense>` boundaries so header and date filters stream
immediately. Successful run ratio is not Resolution Rate; stored knowledge
counts are not source health. Read errors show an explicit unavailable state.
No schema or paid provider call is needed for dashboard reads.

## 5. Request / Path / Verify Examples

| Request | Source path | Relevant verification |
|---|---|---|
| Casual chat or ambiguous message | Orchestrator → router/AI → chat-policy presenter | `pnpm test:concise-chat`, `pnpm test:chat-latency`; inspect fixed boundaries and recorded history behavior. |
| Official BU question | Router → knowledge service; miss may use fresh-info path (BU Links lookup first, then web search) | Inspect selected evidence and fallback; provider/UAT checks are separate from synthetic tests. |
| Reviewed knowledge import / source check | CLI or authenticated check controller → ingestion service → repository / bounded source adapter | `pnpm test:knowledge`, isolated `pnpm test:knowledge:db`; real corpus approval and deployment remain separate. |
| Facility issue and confirmation | Orchestrator → ticket service → repositories/presenter | Check draft/confirm/cancel/status sequence in the intended test environment. |
| PDF/DOCX upload | Chat/LINE controller → study-file → study memory | Check parser/OCR errors and identity-scoped persistence with test files. |
| Saved Playground report | Playground controller/service → repository → report UI | Verify auth, transcript linkage and report reads using the guide. |

For code changes run the narrow meaningful checks plus `pnpm typecheck` and
`pnpm lint`. Use `jg` first for unfamiliar behavior and Graphify for relationships,
then confirm current source. Update the graph after code changes as directed by
AGENTS. This documentation task ran source discovery only, not the application
checks above. Record actual results in the relevant ticket before saying verified.

## 6. Maintenance

Update this map when source ownership, request paths, storage, identity,
integration or auth contracts change. Update Design when presentation changes,
and the local index/ticket when work status changes. Proposed modules/endpoints
belong in plans until source and verification evidence support them; no future
implementation roadmap is inferred by this bootstrap.
