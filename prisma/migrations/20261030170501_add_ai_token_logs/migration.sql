-- CreateTable
CREATE TABLE "ai_token_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bot_run_id" UUID,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
    "completion_tokens" INTEGER NOT NULL DEFAULT 0,
    "cached_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost_usd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_token_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_token_logs_created_at_idx" ON "ai_token_logs"("created_at");

-- CreateIndex
CREATE INDEX "ai_token_logs_model_idx" ON "ai_token_logs"("model");

-- CreateIndex
CREATE INDEX "ai_token_logs_bot_run_id_idx" ON "ai_token_logs"("bot_run_id");
