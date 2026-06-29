-- CreateTable
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "line_user_id" TEXT NOT NULL,
    "session_id" UUID,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "intent" TEXT,
    "channel" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "line_user_id" TEXT NOT NULL,
    "user_message_id" UUID,
    "assistant_message_id" UUID,
    "intent" TEXT,
    "status" TEXT NOT NULL,
    "latency_ms" INTEGER,
    "used_web_search" BOOLEAN NOT NULL DEFAULT false,
    "used_openai" BOOLEAN NOT NULL DEFAULT false,
    "used_study_memory" BOOLEAN NOT NULL DEFAULT false,
    "used_ticket_flow" BOOLEAN NOT NULL DEFAULT false,
    "error_code" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_messages_line_user_id_idx" ON "chat_messages"("line_user_id");

-- CreateIndex
CREATE INDEX "chat_messages_created_at_idx" ON "chat_messages"("created_at");

-- CreateIndex
CREATE INDEX "chat_messages_intent_idx" ON "chat_messages"("intent");

-- CreateIndex
CREATE INDEX "chat_messages_role_idx" ON "chat_messages"("role");

-- CreateIndex
CREATE INDEX "bot_runs_line_user_id_idx" ON "bot_runs"("line_user_id");

-- CreateIndex
CREATE INDEX "bot_runs_created_at_idx" ON "bot_runs"("created_at");

-- CreateIndex
CREATE INDEX "bot_runs_intent_idx" ON "bot_runs"("intent");

-- CreateIndex
CREATE INDEX "bot_runs_status_idx" ON "bot_runs"("status");
