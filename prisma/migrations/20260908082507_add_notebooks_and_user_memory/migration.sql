-- AlterTable
ALTER TABLE "study_materials" ADD COLUMN     "notebook_id" UUID;

-- CreateTable
CREATE TABLE "notebooks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "line_user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '📘',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notebooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_memories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "line_user_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'inferred',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_memories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notebooks_line_user_id_idx" ON "notebooks"("line_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "notebooks_line_user_id_name_key" ON "notebooks"("line_user_id", "name");

-- CreateIndex
CREATE INDEX "user_memories_line_user_id_idx" ON "user_memories"("line_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_memories_line_user_id_key_key" ON "user_memories"("line_user_id", "key");

-- CreateIndex
CREATE INDEX "study_materials_notebook_id_idx" ON "study_materials"("notebook_id");

-- AddForeignKey
ALTER TABLE "study_materials" ADD CONSTRAINT "study_materials_notebook_id_fkey" FOREIGN KEY ("notebook_id") REFERENCES "notebooks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
