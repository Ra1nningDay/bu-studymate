-- CreateTable
CREATE TABLE "rate_limit_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "line_user_id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_limit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rate_limit_events_line_user_id_scope_created_at_idx" ON "rate_limit_events"("line_user_id", "scope", "created_at");

-- CreateIndex
CREATE INDEX "rate_limit_events_created_at_idx" ON "rate_limit_events"("created_at");
