-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "line_user_id" TEXT,
    "password_hash" TEXT,
    "verified_at" TIMESTAMPTZ(6),
    "disabled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_line_user_id_key" ON "users"("line_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed roles
INSERT INTO "roles" ("name") VALUES ('student'), ('admin'), ('viewer');

-- Backfill students (re-runnable: ON CONFLICT DO NOTHING)
INSERT INTO "users" ("email", "line_user_id", "verified_at")
SELECT lower("email"), "line_user_id", "verified_at" FROM "student_accounts"
ON CONFLICT DO NOTHING;

INSERT INTO "user_roles" ("user_id", "role_id")
SELECT u."id", r."id" FROM "users" u
JOIN "student_accounts" s ON u."line_user_id" = s."line_user_id"
CROSS JOIN "roles" r WHERE r."name" = 'student'
ON CONFLICT DO NOTHING;
