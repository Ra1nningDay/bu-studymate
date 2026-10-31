# chat-benchmark-01: Live Playground evaluation

Type: verification
Status: claimed
Updated: 2026-10-31
Blocked by: none

## Scope

User requested 50 real chats visible in Web Chat/Playground to assess cost,
retrieval relevance and response performance. Interpret this as 50 user turns.
Use the existing local server and configured providers/database, new Playground
identities, and the requesting administrator's authorization. No LINE delivery,
ticket confirmation, corpus changes, commit, push or deployment.

## Acceptance criteria

- Record a fixed 50-question cohort before execution and preserve every result.
- Exercise the actual HTTP send and saved-session read endpoints.
- Verify saved run/message links and UI visibility.
- Review selected passages against expected corpus evidence, separately from
  answer groundedness and correct abstention.
- Report measured latency and tokens, and distinguish priced cost from unknown
  or incomplete usage. Do not describe estimates as provider invoices.
- Check unchanged pre-existing conversations and knowledge after the run.

## Verification

Pending.

## Comments

- 2026-10-31: Claimed. Source confirms shared orchestration and real persistence.
  Existing Promptfoo P1 uses in-memory history and cannot prove UI persistence.
  KnowledgeService currently merges retrieval and generation into total-only
  usage; configured model prices may be unsupported. Evaluate these limitations
  without changing application behavior.
