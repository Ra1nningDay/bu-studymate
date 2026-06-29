-- DropIndex
DROP INDEX "knowledge_items_keywords_idx";

-- AlterTable
ALTER TABLE "chat_sessions" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "knowledge_items" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "tickets" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "study_materials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "line_user_id" TEXT NOT NULL,
    "course_name" TEXT NOT NULL,
    "title" TEXT,
    "source_type" TEXT NOT NULL DEFAULT 'text',
    "raw_text" TEXT NOT NULL,
    "summary" TEXT,
    "key_points" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "study_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_chunks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "material_id" UUID NOT NULL,
    "line_user_id" TEXT NOT NULL,
    "course_name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "line_user_id" TEXT NOT NULL,
    "course_name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "due_date_text" TEXT,
    "due_at" TIMESTAMPTZ(6),
    "source_material_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "study_materials_line_user_id_idx" ON "study_materials"("line_user_id");

-- CreateIndex
CREATE INDEX "study_materials_course_name_idx" ON "study_materials"("course_name");

-- CreateIndex
CREATE INDEX "study_materials_created_at_idx" ON "study_materials"("created_at");

-- CreateIndex
CREATE INDEX "material_chunks_material_id_idx" ON "material_chunks"("material_id");

-- CreateIndex
CREATE INDEX "material_chunks_line_user_id_idx" ON "material_chunks"("line_user_id");

-- CreateIndex
CREATE INDEX "material_chunks_course_name_idx" ON "material_chunks"("course_name");

-- CreateIndex
CREATE INDEX "assignments_line_user_id_idx" ON "assignments"("line_user_id");

-- CreateIndex
CREATE INDEX "assignments_course_name_idx" ON "assignments"("course_name");

-- CreateIndex
CREATE INDEX "assignments_status_idx" ON "assignments"("status");

-- CreateIndex
CREATE INDEX "assignments_due_at_idx" ON "assignments"("due_at");

-- AddForeignKey
ALTER TABLE "material_chunks" ADD CONSTRAINT "material_chunks_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "study_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_source_material_id_fkey" FOREIGN KEY ("source_material_id") REFERENCES "study_materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;
