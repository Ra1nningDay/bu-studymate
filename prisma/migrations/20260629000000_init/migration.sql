CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "knowledge_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "source" TEXT,
    "embedding" vector(1536),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tickets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticket_code" TEXT NOT NULL,
    "line_user_id" TEXT NOT NULL,
    "location" TEXT,
    "room" TEXT,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tickets_status_check" CHECK ("status" IN ('PENDING', 'IN_PROGRESS', 'RESOLVED'))
);

CREATE TABLE "chat_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "line_user_id" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'IDLE',
    "draft_data" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "knowledge_items_title_key" ON "knowledge_items"("title");
CREATE INDEX "knowledge_items_category_idx" ON "knowledge_items"("category");
CREATE INDEX "knowledge_items_keywords_idx" ON "knowledge_items" USING GIN ("keywords");

CREATE UNIQUE INDEX "tickets_ticket_code_key" ON "tickets"("ticket_code");
CREATE INDEX "tickets_ticket_code_idx" ON "tickets"("ticket_code");
CREATE INDEX "tickets_status_idx" ON "tickets"("status");

CREATE UNIQUE INDEX "chat_sessions_line_user_id_key" ON "chat_sessions"("line_user_id");
CREATE INDEX "chat_sessions_line_user_id_idx" ON "chat_sessions"("line_user_id");
