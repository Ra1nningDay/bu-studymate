# knowledge-rag-02: Rerank fused evidence

Type: feature
Status: resolved
Updated: 2026-10-13
Blocked by: none for local implementation

## Scope

Preserve up to 40 approved keyword/vector candidates after RRF. Use the existing
OpenAI model/key for one bounded listwise rerank call, then supply at most five
original passages to answer generation. Preserve RRF Top 5 on provider or output
failure. Keep citations, token accounting and existing Web/LINE callers intact.
No BM25, query rewrite, corpus import, new dependency or database migration.

## Acceptance criteria

- A passage below the original Top 5 can enter the answer context.
- Output contains exactly the requested number of unique, supplied IDs; invalid
  JSON, unknown/duplicate/missing IDs, truncation, refusal, timeout and HTTP errors
  preserve the original RRF Top 5.
- Empty/single candidate sets skip reranking. Only approved official candidates
  are sent; text and citation identity remain unchanged.
- Usage includes successful rerank calls, including rejected ranking output when
  usage is available. Trace distinguishes applied, fallback and skipped ranking.
- Focused tests, regression checks, typecheck/lint and graph refresh pass.

## Verification

- `pnpm test:knowledge`: 19 deterministic tests passed. Covers promotion from
  original rank eight, approved/official candidate filtering, original passage
  identity and selected citations, exact count/unique/member validation, refusal,
  truncation, missing key, empty/single skip, candidate bounds, HTTP/malformed
  response/timeout fallback, rejected-output usage and Web/LINE execution traces.
- `pnpm test:knowledge:db`: passed against configured Supabase using synthetic
  data in a randomly named schema. Disjoint keyword/vector Top 20 yielded 40
  distinct candidates. Existing validity/model/approval/transaction checks passed;
  cleanup dropped the synthetic schema and public knowledge checksum matched.
- Router, concise-chat, admin, Playground and report regressions: 51 passed via
  `pnpm exec tsx --test lib/agent-router.test.ts lib/concise-chat.test.ts
  src/services/admin-workspace.test.ts src/services/playground.test.ts
  src/presenters/report.presenter.test.ts`.
- `pnpm typecheck`, `pnpm lint`, `git diff --check`: passed.
- `graphify update .`: AST graph refreshed without model calls. Documentation
  semantic extraction was not performed by this CLI. `graphify update --help`
  treats `--help` as a path in this installed version; the actual update passed.
- No real model calls, corpus import, production quality/latency/cost benchmark,
  authenticated live Web/LINE UAT, migration, commit/push or deployment.

## Comments

- 2026-10-13: Claimed for the user's request to add a reranker. Existing dirty
  hybrid-RAG and unrelated work will be preserved. Implement with the existing
  `OPENAI_MODEL` and `OPENAI_API_KEY`; no real model calls are planned for checks.
- 2026-10-13: Resolved after the checks above. Reranking is active for multiple
  eligible candidates; failed/invalid ranking preserves RRF order. One extra
  bounded LLM call increases latency and cost. The user-deferred real corpus
  remains deferred; evaluate its quality before making accuracy claims.
