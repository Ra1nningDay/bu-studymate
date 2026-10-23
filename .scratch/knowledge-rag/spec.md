# Hybrid campus knowledge

Updated: 2026-10-13
Status: implemented and locally verified; database migration applied

Use the existing PostgreSQL/Supabase and Prisma repository boundary. Retrieve
approved, current university evidence using Thai/English keyword search plus
pgvector, fuse ranks with RRF, and return citations through existing Web/LINE
responses. Legacy/demo records must not acquire approval merely through migration.

First delivery accepts reviewed text and official source URLs in a validated
manifest. Long text is split into bounded passages. Source checks report changes
and failures without silently renewing human approval. No whole-site crawler,
GraphRAG, new admin UI, or additional database/service in that delivery.

The follow-up adds listwise LLM reranking through the existing OpenAI model/key:
retain up to 40 fused candidates, select five original passages, and fall back
to RRF Top 5 on errors or invalid output. That delivery did not add query rewrite or BM25.
See [knowledge-rag-02](issues/02-reranker.md) for the separate verification record.

The next follow-up adds bounded history-based Query Rewrite before embedding,
keyword/vector retrieval and reranking. First turns skip it; failures use the
original query. Generation keeps the original question/history. BM25 remains
out of scope. See [knowledge-rag-03](issues/03-query-rewrite.md).

Knowledge execution trace now records the ordered RAG stages and bounded
diagnostic detail in existing run JSON, with expandable Web Chat/report views.
RRF retains shared SQL timing; no new retrieval behavior/model call is added.
See [knowledge-rag-04](issues/04-execution-trace.md).

FAQ file import adds `sourceKind` FILE (no page fetch or source check) and per-item
`actionLinks` appended to cited answers, so the BU FAQ PDF can be imported without a
crawler. See [knowledge-rag-05](issues/05-faq-file-import.md).

Verification: deterministic regression tests, isolated PostgreSQL retrieval and
ingestion checks when reachable, typecheck/lint, graph refresh. Provider quality,
approved real FAQ corpus, scheduling environment and deployment are separate
evidence from local implementation.

User deferred real knowledge import. The connected Supabase retains 12 legacy
documents, zero approvals and zero chunks. Vercel cron is prepared but needs a
production deployment and CRON_SECRET; it is not active from this local task.

Ticket: [knowledge-rag-01](issues/01-hybrid-knowledge.md).
