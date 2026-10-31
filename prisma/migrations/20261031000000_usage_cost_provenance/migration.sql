-- Old fallback amounts remain stored, with no invented provenance or token splits.
ALTER TABLE "ai_token_logs"
  ALTER COLUMN "cost_usd" TYPE DECIMAL(16,10),
  ALTER COLUMN "cost_usd" DROP DEFAULT,
  ALTER COLUMN "cost_usd" DROP NOT NULL,
  ADD COLUMN "cost_source" TEXT,
  ADD COLUMN "web_search_calls" INTEGER;

ALTER TABLE "ai_token_logs" ADD CONSTRAINT "ai_token_logs_web_search_calls_nonnegative"
  CHECK ("web_search_calls" IS NULL OR "web_search_calls" >= 0);
