# chat-latency-01: RAG waterfall, parallel DB orchestration and Web/Playground SSE

Type: feature
Status: resolved
Updated: 2026-10-27
Blocked by: none

## Scope

Implement the three chat latency optimizations in [spec.md](../spec.md):
1. Skip RAG reranker when `candidates.length <= 5`, skip query rewrite when a question with history is standalone, decouple `OPENAI_QUERY_REWRITE_MODEL` / `OPENAI_RERANK_MODEL` (default `gpt-6-luna`), and calibrate `max_completion_tokens` across all 7 Chat Completions calls (`1536` / `2048` / `4096` / `8192`).
2. Collapse `getRecentCompletedChatHistory` into one SQL CTE query, parallelize session/history reads and pre-/post-execution message/run writes in `ChatOrchestrationService.createBotReply`, fetch raw 8-message history only for `ASK_BU_INFO` / `ASK_FRESH_INFO`, and bypass `classifyWithAgentRouter` on `ticket` hard-guards unless a safety-critical hint is present.
3. Add opt-in SSE (`Accept: text/event-stream`) streaming for final answer generation in `/api/chat` and `/api/admin/playground/message`, and consume progressive deltas in `app/admin/chat/playground.tsx`.

## Acceptance criteria

- `rerankKnowledge` skips OpenAI calls when `candidates.length <= 5` (`status: "skipped"`) and still ranks 6–40 candidates into 5 items using `OPENAI_RERANK_MODEL` (`max_completion_tokens: 2048`).
- `rewriteKnowledgeQuery` skips OpenAI calls when `history` is empty or the question is standalone (`status: "skipped"`), and rewrites follow-ups using `OPENAI_QUERY_REWRITE_MODEL` (`max_completion_tokens: 1536`); other Chat Completions calls use calibrated ceilings (`1536` ticket extract, `4096` RAG answer & study extract, `8192` general chat & study answer; safety-critical exempt).
- `ChatLogRepository.getRecentCompletedChatHistory` executes one parameterized query excluding orphan/non-matching roles, and `getRecentChatHistory` defaults to `limit = 8` with optional `excludeMessageId`.
- `ChatOrchestrationService.createBotReply` runs session + completed history in parallel, skips raw history for intents that do not consume it, runs pre- and post-execution message/run persistence in parallel, and skips router network calls on ordinary `ticket` hard-guards while still routing safety-critical messages during `CREATING_TICKET` to safety guidance.
- `ChatController.handleWebChat` and `PlaygroundController.send` preserve `400`/`401`/`403`/`429` JSON guards and default `200` JSON responses, and stream `delta`/`reset`/`replace`/`done`/`error` SSE events when `Accept: text/event-stream` is sent.
- `app/admin/chat/playground.tsx` renders progressive assistant deltas, handles RAG miss resets and citation replacements, and links the completed `runId` to Execution Trace.
- Focused unit tests, existing regression suites, `pnpm typecheck`, `pnpm lint` and `graphify update .` pass.

## Verification

Passed locally on 2026-10-27:
- `pnpm typecheck`: passed (0 errors).
- `pnpm lint`: passed (0 errors, 0 warnings).
- `pnpm test:chat-latency`: 5/5 passed (incremental Thai/Unicode JSON `"answer"` prefix decoding, concurrent 3-phase DB orchestration assertions, `rewriteKnowledgeAnswer` SSE delta streaming + `NO_VERIFIED_INFO_FOUND` suppression + uncited `onTextReset`, `createWebSearchResponse` Responses API SSE delta streaming + trailing footer trimming, and `PlaygroundController` / `ChatController` `Accept: text/event-stream` SSE framing + error safety).
- `pnpm test:knowledge`: 47/47 passed (including `<= 5` rerank skip, 6+ rerank execution, `OPENAI_RERANK_MODEL`/`2048`, standalone query rewrite skip with history, follow-up rewrite execution with `OPENAI_QUERY_REWRITE_MODEL`/`1536`, RAG answer `4096`, FAQ action links, and temperature omission).
- `pnpm test:concise-chat`: 20/20 passed (including ticket hard-guard router bypass + safety-critical hint override during `CREATING_TICKET`, and single-CTE SQL `getRecentCompletedChatHistory` assertions).
- Regression suites: `pnpm test:bulinks` (23/23), `pnpm test:openai-params` (3/3), `pnpm test:admin-auth` (85/85), `pnpm test:student-auth` (66/66), and `pnpm exec tsx --test lib/agent-router.test.ts src/presenters/report.presenter.test.ts lib/knowledge-trace.test.ts` (11/11) — 260/260 unit tests passed total.
- `graphify update .`: rebuilt AST graph (893 nodes, 1414 edges, 89 communities).

### Limitations & Evidence Boundary

- All unit and controller checks use synthetic repositories and intercepted `fetch` streams; no live PostgreSQL query execution, live OpenAI streaming TTFT benchmark, browser manual UAT, or production deployment was run in this task.
- `isStandaloneKnowledgeQuery` and `mightBeSafetyCritical` are conservative Thai/English heuristics; real-corpus recall/safety behavior should be monitored via saved `BotRun` traces and Promptfoo evals before tuning further.

## Comments

- 2026-10-27: Claimed for user request on AI & Chat Orchestration Latency. User confirmed keeping `gpt-6-luna` as default for `OPENAI_QUERY_REWRITE_MODEL` and `OPENAI_RERANK_MODEL`.
- 2026-10-27: Implemented RAG waterfall skips/model decoupling, parallel DB orchestration + single-CTE completed history + ticket hard-guard router bypass, and opt-in SSE streaming for `/api/chat`, `/api/admin/playground/message`, and `/admin/chat`. Updated `ARCHITECTURE.md`, `DESIGN.md`, `docs/knowledge-rag.md`, and `docs/playground.md`. All 260 tests, `typecheck`, `lint`, and `graphify update .` passed.
