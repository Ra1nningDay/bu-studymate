# Chat routing, workflows and AI organization

Updated: 2026-10-31
Status: implemented and verified locally; see ticket 02 for evidence and limits
Planning: [chat-structure-01](issues/01-structure-plan.md)
Implementation: [chat-structure-02](issues/02-separate-chat-modules.md)

## Outcome and scope

A maintainer can locate routing, each chat workflow, model calls and presentation
from the directory tree and an ownership table. Keep the existing layered
architecture and fixed workflow execution. Preserve observable behavior.

The user requested the plan, then authorized implementation. Runtime changes
and verification belong to ticket 02. No new agent framework, registry, generic
workflow runner, provider abstraction, database schema or model/prompt change.

## Pre-refactor source and problems (2026-10-31 snapshot)

| Current owner | Confirmed responsibility | Problem to address |
|---|---|---|
| `src/lib/router/agent-router.ts` | Classifier schemas, prompts, Jev/OpenAI calls and classifier policy | Chat guards and final route resolution live elsewhere. |
| `src/services/chat-orchestration.service.ts` | Session/history loading, guards, route resolution, all workflow branches, text/Flex preparation, SSE reconciliation, run/message/usage writes | Execution lifecycle and individual workflows share one large file. |
| `src/services/knowledge.service.ts` + `src/lib/rag/` | Rewrite, hybrid retrieval, rerank, evidence-based generation | Answer adapter is in `ai.ts`; knowledge-miss fallback is in orchestration. |
| `src/lib/fresh-info.ts` | BU Links lookup, web-search fallback, source selection, stream reset and usage propagation | Business workflow is under `lib`. |
| `src/services/study-memory.service.ts` + `src/lib/study/` | Saved materials, notes, assignments and tutoring | Chat command/branch coordination is in orchestration. |
| `src/services/ticket.service.ts` | Draft/session state, confirmation, creation, status and admin operations | Chat dispatch is in orchestration; extraction adapter is in `ai.ts`. |
| `src/lib/ai.ts` | General/clarification prompts, web search, source helpers, knowledge answer and ticket extraction | Unrelated model tasks share one entry/file. |
| `src/presenters/agent-workflow.presenter.ts` | Static topology and interpretation of saved execution logs | Source references need updating when execution files move. |
| `tsconfig.json` | `@/lib/*` searches root plus five domain folders | Imports such as `@/lib/agent-router` conceal actual folder ownership. |

`src/app/admin/agent/workflow/` is the read-only explorer UI. Its graph is not a
runtime workflow definition. Keep execution modules independent of this UI.

## Proposed directory ownership

Paths below define the implementation target; verified delivery is recorded in ticket 02.

```text
src/services/
  chat/
    README.md                       # where to change each behavior
    chat-contracts.ts               # existing BotReply/input/stream and resolved-route types
    chat-reply.ts                   # existing shared asReply helper
    chat-orchestration.service.ts   # one turn's lifecycle and explicit dispatch
    routing/
      chat-route.ts                # hard guards, safety hints and final route resolution
    workflows/
      knowledge.workflow.ts        # KnowledgeService -> fresh-info on miss
      fresh-info.workflow.ts       # existing BU Links -> web-search workflow
      study.workflow.ts            # /addnote, assignments, notebooks, study Q&A dispatch
      ticket.workflow.ts           # reset/cancel, continue draft and status dispatch
      general-chat.workflow.ts     # General Chat / Unknown / Out-of-scope dispatch
  knowledge.service.ts             # existing RAG owner retained
  study-memory.service.ts          # existing study persistence/domain owner retained
  ticket.service.ts                # existing ticket domain/admin owner retained
  bulinks.service.ts               # existing live lookup owner retained

src/lib/
  router/                          # classifier, classifier policy, intent and tests retained
  rag/                             # existing retrieval adapters retained
  study/                           # existing study AI/file adapters retained
  ai/
    index.ts                       # explicit exports for existing public AI symbols
    types.ts                       # existing shared AI/source result types
    config.ts                      # existing isAiConfigured helper
    context.ts                     # existing shared grounded-answer prompt and Bangkok date
    general-chat.ts                # general + clarification calls and their prompts
    knowledge-answer.ts            # rewriteKnowledgeAnswer, evidence validation and prompt
    web-search.ts                  # Responses API search, parsing and existing wrapper
    answer-sources.ts              # source helpers and existing verification functions
    text.ts                        # shared existing text cleanup used by multiple adapters
    ticket-extract.ts              # extractTicketDraftFromLLM and extraction prompt
  openai-stream.ts                 # existing stream decoder retained

src/presenters/
  chat-workflow.presenter.ts        # extracted guide/study/assignment text from orchestrator
  chat-policy.presenter.ts          # existing localized policy replies retained
  chat-response.presenter.ts        # existing HTTP response shaping retained
  chat-stream.presenter.ts          # existing SSE frame encoding retained
  line-flex.presenter.ts            # existing LINE Flex owner retained
  agent-workflow.presenter.ts       # explorer topology/evidence, source labels updated
```

Keep helpers private to their owning file when only that file uses them. Create
`text.ts` only for existing cleanup shared by the extracted adapters. Keep each
prompt beside its call; a separate prompt catalog adds no value to this refactor.
`ai/index.ts` preserves existing public exports, including currently unused ones;
internal callers use the owning submodule directly.

## Interfaces and dependency direction

1. Controllers call `ChatOrchestrationService.createBotReply()` as today. They
   import input/reply/stream types from `chat-contracts.ts`, not the implementation.
2. Orchestration owns history selection, initial/final persistence, run failure
   recording, shared output/citation handling and final stream reconciliation.
   Its branch selection stays explicit; each substantive branch delegates to its
   workflow. Guide text comes from the presenter without a new guide workflow.
3. `chat-route.ts` receives message, session and history and returns the existing
   resolved route. It owns hard-guard precedence and invokes the existing
   classifier. Classifier confidence/target/safety validation remains in router.
4. Each workflow owns its branch decisions and branch trace/usage results. Keep
   existing arguments/results where practical. Pass the relevant existing service
   dependencies explicitly; retain orchestrator constructor compatibility for
   current fixtures. Introduce no base class or universal execution context.
5. Workflows call existing domain services and task-specific AI adapters.
   Knowledge alone calls fresh-info on a miss. Fresh-info calls BU Links and the
   search adapter. Shared services/adapters never import chat workflows.
6. Existing repository ownership remains. Newly extracted workflow code uses
   services/repositories rather than introducing direct Prisma queries. Existing
   `StudyMemoryService` Prisma access is a separate pre-existing concern.
7. Presenters format text/Flex/HTTP/SSE. They do not select routes or invoke models.
   The explorer reads saved metadata; runtime never imports explorer node/edge data.
8. Shared AI usage comes from the current `src/dtos/ai-usage.dto.ts`. Keep the
   existing `ExecutionLogEntry` DTO and persisted shape; avoid duplicate contracts.

## Ordered implementation and checks

### 1. Freeze the current behavioral baseline

- Re-read the latest tree and callers before moving files. Cost telemetry work
  currently edits shared AI/orchestration contracts: use its latest compatible
  state, not a copy from this planning snapshot. Coordinate overlapping edits.
- Inventory static imports, dynamic imports, fixtures, package scripts, eval
  providers/configs, CI path filters and explorer source strings.
- Run the existing offline suites. Add table-driven characterization only where
  the matrix below has a gap, before extraction. Record pre-existing failures.
- Done: the baseline identifies expected routes, calls, state mutations, output,
  traces and usage, and runs with controlled fetch/repositories and no real writes.

### 2. Extract AI files and shared chat contracts

- Split `ai.ts` into the target task files; preserve prompt bytes, request options,
  fallback paths, validation, streaming, error handling and all public exports.
- Move existing chat contracts out of the orchestrator without redesigning them.
- Update actual imports in controllers, presenters, services, tests, scripts and
  eval providers. The removed `ai.ts` is replaced by the normal directory export,
  not an extra compatibility file or a second implementation.
- Done: AI/request-parameter, RAG, concise-chat and SSE tests pass; typecheck and
  lint pass; all existing exported AI symbols have an owner.

### 3. Extract chat routing and workflows

- Move hard-guard helpers and `resolveRoute` into `routing/chat-route.ts`. Keep
  the existing no-router/history shortcuts and safety override order intact.
- Move `fresh-info.ts` into `fresh-info.workflow.ts`, including source compaction,
  error fallback, stream-reset behavior and usage propagation.
- Extract knowledge execution plus knowledge-miss fallback into its workflow;
  keep retrieval and generation orchestration in `KnowledgeService`.
- Extract study, ticket and general-chat branch logic into their target workflows.
  Existing study/ticket services remain shared by upload/admin and chat callers.
- Move only the reply formatting currently extracted from the orchestrator into
  `chat-workflow.presenter.ts`. Preserve localized strings and Flex behavior.
- Keep output reconciliation and turn-level logging in the orchestrator; collect
  each branch's trace and usage once. Preserve dependency injection in fixtures.
- Done: the orchestrator contains lifecycle/dispatch, while branch implementations
  and model prompts live at the documented owners; behavioral matrix passes.

### 4. Make paths and supporting references truthful

- Replace hidden-domain imports with explicit paths such as
  `@/src/lib/router/agent-router`, `@/src/lib/rag/knowledge-query` and
  `@/src/services/chat/workflows/fresh-info.workflow`.
- Migrate both `@/lib/*` and `@/src/lib/*` users that depend on domain fallback
  lookup, including auth/bulinks/study callers if needed to remove that lookup.
  These are path-only edits. Retain root aliases; remove domain fallback arrays
  from `tsconfig.json` after every dependent caller is migrated.
- Move chat integration tests from `src/lib/concise-chat.test.ts` and
  `src/lib/chat-latency-sse.test.ts` beside the chat module; update package scripts.
  Keep router tests with router, retrieval tests with RAG and stream decoder tests
  with their owner; existing mixed suites may remain intact during the move.
- Update `evals/providers/{app-router,p1-orchestration}.ts`,
  `evals/concise-chat/fixtures.ts`, operational/manual scripts and any current
  `.scratch` execution scripts that import a moved file. Preserve historical reports.
- Correct `.github/workflows/promptfoo.yml`'s obsolete `lib/agent-router.ts`
  path filter to the affected source paths. Keep its current evaluation semantics;
  expanding paid eval/release gating is a separate task.
- Update source strings in `agent-workflow.presenter.ts` without changing node IDs,
  edges or matching recorded `action` labels. Update architecture/eval guide links
  and add the one module README ownership map. Keep architecture claims current.
- Done: typecheck resolves static/dynamic imports, targeted search finds no stale
  executable references, CI paths match files, and explorer regressions pass.

### 5. Final verification and handoff

- Run `pnpm typecheck` and `pnpm lint` and all repository offline test files under
  `src` (not only the suites referenced by existing package scripts).
- Verify app compilation using `pnpm db:generate` then `pnpm exec next build` in
  an isolated fixture environment. This bypasses the package build command's
  production migration hook. Use synthetic build data where routes require it;
  record any unavailable full-app checks instead of using live DB writes.
- Run `graphify update .` and confirm the important call paths in current source.
- Read the saved legacy trace/report fixtures and test route/presenter rendering.
  Browser visual UAT is needed only if an extraction changes rendered behavior;
  paid provider, real LINE, live database and deployed UAT are separate evidence.
- Done: documented directory ownership matches source, offline checks pass (or
  baseline failures are explicitly accounted for), old saved logs remain readable,
  and ticket/index state distinguishes local verification from release.

## Behavioral matrix to preserve

| Area | Required evidence |
|---|---|
| Entry points | Web, Playground and LINE still share `createBotReply`; auth, signature checks and DTO behavior remain at current owners. |
| Routing | Every current intent/target; menu, `/addnote`, ticket code, active draft, reset/cancel guards; safety overrides; low-confidence/invalid-target and provider fallbacks. |
| Context | Router latest completed turn, General Chat completed history, knowledge/fresh raw-history selection and shortcut query counts remain as current source. |
| Knowledge/fresh | Retrieval/rewrite/rerank decisions; miss -> fresh; BU Links success skips search; BU Links error permits search; empty/failed search fallback. |
| Study/ticket | Valid/invalid note command; assignments/notebooks/Q&A; draft continuation/confirmation/status/reset; preserve identities and service mutation order. |
| Replies | Existing Thai/English text, policy/clarification behavior, sources/action links and Flex payloads. |
| Streaming | JSON and SSE; delta/reset/replace/done/error order; no duplicated fallback text; final saved reply equals the final delivered reply. |
| Persistence/usage | Existing success/error linkage and write timing, selectedTarget/router fields, per-call usage and cost metadata as present at implementation start; no double-counting on fallback. |
| Explorer | Existing action strings/node IDs, trace interpretation, legacy/missing fields and source references; topology remains a presentation map. |

## Risks, exclusions and completion boundary

- Cost telemetry is active concurrent work on the same files. Rebase the proposed
  moves on the latest source and preserve newly added usage fields/callbacks.
- Path aliases and dynamic imports are the main move risk. Complete the import
  inventory and compile/eval-provider import checks before deleting old paths.
- Fixture defaults can instantiate real repositories. Stub token usage and every
  mutation dependency explicitly; do not run the live P1 provider as an offline test.
- Existing timeout/cancellation, idempotency/transaction, source-verification,
  telemetry completeness and StudyMemory repository-layer gaps are unchanged by
  a structural move. Record them separately rather than mixing repairs here.
- Preserve existing prompt/model/config, schema, stored histories, ticket state
  and error semantics. No migrations, private env edits, paid calls, commit, push
  or deployment are included in this plan's execution scope.
- Runtime acceptance and checks are recorded in ticket 02. The plan records
  intent and ownership; it is not independent proof of deployment or live UAT.
