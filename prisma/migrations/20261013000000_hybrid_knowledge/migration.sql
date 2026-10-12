ALTER TABLE "knowledge_items"
  ADD COLUMN "source_url" TEXT,
  ADD COLUMN "source_hash" TEXT,
  ADD COLUMN "content_hash" TEXT,
  ADD COLUMN "verified_by" TEXT,
  ADD COLUMN "verified_at" TIMESTAMPTZ,
  ADD COLUMN "review_after" TIMESTAMPTZ,
  ADD COLUMN "valid_from" TIMESTAMPTZ,
  ADD COLUMN "valid_until" TIMESTAMPTZ,
  ADD COLUMN "source_status" TEXT,
  ADD COLUMN "source_checked_at" TIMESTAMPTZ;

CREATE TABLE "knowledge_chunks" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "knowledge_item_id" UUID NOT NULL REFERENCES "knowledge_items"("id") ON DELETE CASCADE,
  "ordinal" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "document_hash" TEXT NOT NULL,
  "search_text" TEXT NOT NULL,
  "search_vector" TSVECTOR GENERATED ALWAYS AS (to_tsvector('simple', "search_text")) STORED,
  "embedding" vector(1536) NOT NULL,
  "embedding_model" TEXT NOT NULL,
  CONSTRAINT "knowledge_chunks_knowledge_item_id_ordinal_key" UNIQUE ("knowledge_item_id", "ordinal")
);

CREATE INDEX "knowledge_chunks_search_vector_idx" ON "knowledge_chunks" USING GIN ("search_vector");
-- shortcut: exact vector search for the initial small corpus; add HNSW after measured query latency warrants it.
ALTER TABLE "knowledge_chunks" ENABLE ROW LEVEL SECURITY;
-- Knowledge is accessed by the server's Prisma database role, not anonymous REST clients.
REVOKE ALL ON "knowledge_chunks" FROM PUBLIC;
