# Chat Orchestration, RAG & SSE Streaming Latency

Updated: 2026-10-27
Status: resolved locally, 2026-10-27; see [chat-latency-01](issues/01-orchestration-rag-sse.md)

## What the user asked for

1. **Reduce sequential LLM waterfall in Campus RAG (`ASK_BU_INFO`):**
   - Skip `rerankKnowledge` when candidate count does not exceed `take` (`candidates.length <= take`, i.e. `<= 5`), avoiding a redundant ranking call over passages that all enter generation anyway.
   - Decouple `OPENAI_QUERY_REWRITE_MODEL` and `OPENAI_RERANK_MODEL` in environment configuration (defaulting to `gpt-6-luna` per user preference) and calibrate `max_completion_tokens` by task tier (`1536` for query rewrite & ticket draft extraction, `2048` for multi-chunk rerank, `4096` for RAG grounded answer & study note extraction, and `8192` for General Chat & Study Memory tutoring).
   - Skip `rewriteKnowledgeQuery` when a question with conversation history is already standalone (no Thai/English follow-up or anaphoric markers and sufficient topic specificity).
2. **Reduce sequential database queries and redundant router calls in `ChatOrchestrationService.createBotReply`:**
   - Run `getOrCreateChatSession` and `getRecentCompletedChatHistory` concurrently, and collapse `ChatLogRepository.getRecentCompletedChatHistory` from two sequential queries into one parameterized SQL CTE join. Skip `getRecentCompletedChatHistory` when a deterministic hard-guard applies without router invocation.
   - Bound `ChatLogRepository.getRecentChatHistory` to 8 messages by default (instead of 50) and call it only for intents that consume raw history (`ASK_BU_INFO`, `ASK_FRESH_INFO`).
   - Run pre-execution writes (`createChatMessage` + `createBotRun` + optional raw history fetch) in parallel via pre-generated message UUIDs, and run post-execution writes (`createChatMessage` + `updateBotRun`) in parallel.
   - Skip `classifyWithAgentRouter` when `hardGuardRoute` matches `ticket` (`BU-TICKET-*` or `CREATING_TICKET` state) unless a local safety-critical hint pattern triggers, preserving safety overrides without paying router latency on ordinary ticket turns.
3. **Add Server-Sent Events (SSE) response streaming for Web Chat and Playground:**
   - Support opt-in `Accept: text/event-stream` on `ChatController.handleWebChat` (`/api/chat`) and `PlaygroundController.send` (`/api/admin/playground/message`) while keeping existing JSON responses unchanged for non-streaming callers.
   - Stream progressive tokens during final answer generation (`GENERAL_CHAT`, `UNKNOWN`, `ASK_BU_INFO`, `ASK_STUDY_MEMORY`, `ASK_FRESH_INFO`), holding sentinel strings (`NO_VERIFIED_INFO_FOUND`, `VERIFIED_SOURCE_NOT_FOUND`) and supporting `reset`/`replace`/`done`/`error` events so Web Chat (`app/admin/chat/playground.tsx`) lowers Time-to-First-Token (TTFT) while preserving verified citations and run trace linkage.

## Decisions

- Agreed with the user: keep `gpt-6-luna` as default for `OPENAI_QUERY_REWRITE_MODEL` and `OPENAI_RERANK_MODEL` for cost efficiency and assign task-calibrated `max_completion_tokens` tiers (`1536` / `2048` / `4096` / `8192`) aligned with reasoning depth, output size, and HTTP timeouts.
- Maintain strict backward compatibility for LINE webhook and existing JSON HTTP callers: streaming activates only when `Accept: text/event-stream` is requested, and OpenAI calls omit `stream: true` when no stream callback is supplied.
- No Prisma schema migration required (`bot_runs` and `chat_messages` already use UUID columns without cross-table FK constraints).
