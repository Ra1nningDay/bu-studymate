# knowledge-rag-01: Hybrid campus knowledge

Type: feature
Status: resolved
Updated: 2026-10-13
Blocked by: none for this delivery; user deferred the real corpus

## Scope

- Add evidence metadata and chunk search storage with an additive migration.
- Validate reviewed manifests, create compatible embeddings, and atomically
  replace a document's searchable passages only after successful preparation.
- Search current approved evidence with Thai/English full-text and vector RRF.
- Preserve facade/callers, multiple evidence context and citations; retain misses.
- Provide a bounded official-source checker and document recurring operation.
- Update affected evaluations, documentation and regression evidence.

## Acceptance criteria

- Keyword and vector candidates are filtered before ranking; legacy, expired,
  stale, future and wrong-model evidence cannot answer through internal RAG.
- Thai segmentation is identical at ingestion/query time; more than 100 items
  remain searchable and insufficient evidence does not become a forced answer.
- Invalid manifests/vectors/URLs are rejected; failed imports preserve the
  previous document and embeddings; unchanged content does not re-embed.
- Returned citations belong to retrieved evidence, propagate to Web/LINE and
  recorded runs, and cannot be invented by generated answer text.
- Source checks detect changes/errors without extending approval freshness.
- Focused tests, typecheck/lint and graph refresh pass; live limits are explicit.

## Verification

- `pnpm test:knowledge`: 14 deterministic tests passed. Covers Thai tokens,
  chunk bounds, manifest/vector validation, source DNS/redirect restrictions,
  re-embedding avoidance, failure preservation, citation IDs, provider outages,
  embedding token totals, Web/LINE source propagation, cron authorization and
  no embedding calls when the approved corpus is empty.
- `pnpm test:knowledge:db`: passed against the configured Supabase with synthetic
  data in a uniquely named schema. Keyword/semantic/RRF, similarity cutoff,
  approval/review/validity/model filters, out-of-band edits, 120 legacy rows,
  transactional rollback and older-approval rejection passed. Cleanup removed
  the test schema and a public-knowledge checksum matched before/after.
- Existing router, concise-chat, admin, Playground and report tests: 51 passed.
- `pnpm typecheck`, `pnpm lint`, `git diff --check`: passed.
- `graphify update .`: AST-only refresh passed, without model calls. Doc semantic
  graph extraction was not performed by this CLI.
- Live read-only source snapshot: official BU FAQ URL fetched through the bounded
  DNS-pinned HTTPS adapter; no source content was imported or approved.
- `pnpm db:migrate:deploy`: only `20261013000000_hybrid_knowledge` was pending;
  applied successfully. Afterwards 12 existing documents remained, zero approvals,
  zero chunks and no remaining synthetic schemas were observed.
- Prisma generation initially hit Windows EPERM because the checkout's dev
  server held the DLL. Verified exact process ownership, stopped only its two
  Next processes, generated successfully and restarted on port 3000. Local
  `/login` returned 200; unauthenticated `/api/knowledge/check` returned 401.
- No real embedding/answer-provider calls, approved-corpus quality benchmark,
  authenticated operational Web/LINE UAT, commit/push or production deployment.
  Cosine cutoff and RRF/passages limits remain initial values for later calibration.

## Comments

- 2026-10-13: User authorized the proposed hybrid RAG implementation on the
  existing Supabase. Git working tree was clean on master. No commit/push or
  deployment requested. Existing demo seeds will remain unapproved.
- 2026-10-13: User explicitly said no real knowledge corpus is needed yet.
  Delivered implementation, additive Supabase schema and operational guide;
  no existing rows were auto-approved. Next action: supply reviewed manifests,
  calibrate on approved questions, set production CRON_SECRET and deploy before
  claiming a live RAG or active schedule.
