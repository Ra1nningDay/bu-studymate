# knowledge-rag-03: Rewrite retrieval queries with conversation context

Type: feature
Status: resolved
Updated: 2026-10-13
Blocked by: none for local implementation

## Scope

Use recent conversation history to resolve follow-up references before embedding,
keyword/vector retrieval and reranking. Reuse the existing OpenAI model/key.
Keep the student's original question/history for answer generation. Skip model
calls without history or eligible evidence; fall back to the original query on
provider/output failures. Preserve existing callers and report usage/status.
No BM25, corpus import, database changes, new dependency or service.

## Acceptance criteria

- A Wi-Fi follow-up about iPhone uses a standalone Wi-Fi/iPhone query for all
  retrieval/rerank stages, while generation receives the original follow-up.
- History is bounded and treated as untrusted topic context, not verified facts.
- Missing key, invalid/empty/oversized output, refusal, truncation, HTTP errors
  and timeouts preserve the original query. Available provider usage is counted.
- Empty corpus and invalid original input skip all knowledge model calls.
- Existing evaluation override forwards history; Web/LINE trace records rewrite.
- Focused tests, regressions, typecheck/lint and graph refresh pass.

## Verification

- `pnpm test:knowledge`: 24 deterministic tests passed. New checks cover the
  Wi-Fi/iPhone rewrite reaching embedding/retrieval/rerank, original question and
  history retained for generation, bounded Unicode history, invalid/empty/oversized
  output, refusal/truncation/HTTP/timeout/missing-key fallback, first-turn skip,
  rejected-output usage, embedding outage, Web/LINE trace and empty-corpus skip.
- Existing router, concise-chat, admin, Playground and report regressions:
  51 passed using the same five-file `tsx --test` command as knowledge-rag-02.
- `pnpm typecheck`, `pnpm lint`, `git diff --check`: passed.
- `graphify update .`: AST refresh passed without model calls. Documentation
  semantic graph extraction was not performed by this CLI.
- Source inspection confirms the P1 evaluation override forwards all retrieve
  arguments, including history. Empty/oversized original queries retain the
  existing early return before any provider call.
- No SQL/schema changes; isolated DB checks were not repeated. Their preceding
  reranker evidence remains in knowledge-rag-02 and is not a new DB verification.
- No real provider/model calls, approved-corpus quality/latency/cost evaluation,
  corpus import, authenticated live UAT, commit/push or deployment.

## Comments

- 2026-10-13: Claimed for the requested history → query rewrite → hybrid search
  → RRF → reranker flow. Every eligible request with history gets one bounded
  rewrite call; first-turn requests retain the existing query directly.
- 2026-10-13: Resolved after the checks above. Structural output checks do not
  prove semantic fidelity; corpus evaluation must check topic drift, standalone
  questions, Thai/English references and changed constraints. Next action remains
  reviewed corpus/evaluation before claiming quality gains or production readiness.
