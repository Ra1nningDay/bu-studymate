# Live Playground cost and retrieval evaluation

Updated: 2026-10-31

Run 50 real user messages through the local authenticated Playground HTTP API,
using new web-only sessions. Include corpus-grounded questions, paraphrases,
follow-ups and explicit unknowns. Keep saved conversations and run traces visible
in the existing admin UI. Do not change models, prompts, knowledge or other users.

1. Inspect authentication, corpus and usage recording; record baseline invariants.
2. Send 50 messages, sequentially within each conversation, with bounded parallelism.
3. Read persisted runs/messages/usage, review retrieved evidence and answers,
   and report latency, groundedness and cost coverage separately.

Acceptance and evidence: [chat-benchmark-01](issues/01-live-playground.md).
