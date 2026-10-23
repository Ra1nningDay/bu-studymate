-- CreateTable
CREATE TABLE "student_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "line_user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "verified_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "student_accounts_line_user_id_key" ON "student_accounts"("line_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_accounts_email_key" ON "student_accounts"("email");
