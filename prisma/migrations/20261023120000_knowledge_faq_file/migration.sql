ALTER TABLE "knowledge_items"
  ADD COLUMN "source_kind" TEXT NOT NULL DEFAULT 'PAGE';

ALTER TABLE "knowledge_items"
  ADD COLUMN "action_links" JSONB NOT NULL DEFAULT '[]'::jsonb;
