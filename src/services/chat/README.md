# Chat execution ownership

Web Chat, Playground and LINE call
[`ChatOrchestrationService.createBotReply`](chat-orchestration.service.ts).
The orchestrator loads history/session state, selects and dispatches one route,
reconciles final SSE output, and records messages, runs and token usage.

| Change | Owner |
|---|---|
| Menu/command/ticket hard guards, safety precedence, classifier context | [`routing/chat-route.ts`](routing/chat-route.ts) |
| Classifier prompts, Jev/OpenAI requests, confidence/target validation | [`lib/router/agent-router.ts`](../../lib/router/agent-router.ts) |
| Knowledge answer and knowledge-miss fallback | [`workflows/knowledge.workflow.ts`](workflows/knowledge.workflow.ts) |
| BU Links first, search fallback, source compaction and fallback stream reset | [`workflows/fresh-info.workflow.ts`](workflows/fresh-info.workflow.ts) |
| Add note, list assignments/notebooks, view notebook and study Q&A dispatch | [`workflows/study.workflow.ts`](workflows/study.workflow.ts) |
| Reset/cancel, continue ticket and ticket-status dispatch | [`workflows/ticket.workflow.ts`](workflows/ticket.workflow.ts) |
| General Chat, Unknown Message and Out-of-scope Request dispatch | [`workflows/general-chat.workflow.ts`](workflows/general-chat.workflow.ts) |
| Shared reply/input/stream/route types | [`chat-contracts.ts`](chat-contracts.ts) |
| Existing reply construction helper | [`chat-reply.ts`](chat-reply.ts) |
| Guide, note/assignment and ticket fallback text | [`chat-workflow.presenter.ts`](../../presenters/chat-workflow.presenter.ts) |
| Localized policy replies | [`chat-policy.presenter.ts`](../../presenters/chat-policy.presenter.ts) |

Existing domain owners remain `KnowledgeService`, `StudyMemoryService`,
`TicketService` and `BuLinksService` in the parent `services/` directory. They
serve other callers, including uploads and administration. Workflows coordinate
chat branches and keep their existing trace/usage results; they do not replace
domain persistence or repository interfaces.

Model calls and their prompts live in `src/lib/ai/{general-chat,knowledge-answer,
web-search,ticket-extract}.ts`. Shared grounded-answer context is in `context.ts`;
source helpers are in `answer-sources.ts`. Study and retrieval adapters stay in
`src/lib/study/` and `src/lib/rag/`. Use explicit submodule imports. `lib/ai/index.ts`
retains the existing public AI exports for callers testing that surface.

Dependencies flow from controllers to orchestration/routing/workflows, then to
domain services, repositories and adapters. Presenters format responses. Shared
domain services and AI adapters do not import chat workflows.

The read-only admin explorer in `src/app/admin/agent/workflow/` uses
`src/presenters/agent-workflow.presenter.ts` to display topology and saved evidence.
It does not define or execute these workflows. Keep saved action labels, intent/
target values, SSE events, usage entries and legacy trace reading stable when
changing execution ownership.

## Verification

The chat suites are colocated here: `concise-chat.test.ts`,
`chat-latency-sse.test.ts` and `chat-workflows.test.ts`. They exercise real routing/
orchestration with controlled fetch and persistence. Router, RAG and presenter
regressions remain beside their owners. Run the complete offline suite plus
`pnpm typecheck` and `pnpm lint` for changes across these seams.

Implementation evidence and limits:
[chat-structure-02](../../../.scratch/chat-structure/issues/02-separate-chat-modules.md).
