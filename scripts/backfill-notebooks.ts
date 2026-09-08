/**
 * Backfill script: creates Notebook records from existing distinct course names
 * and links existing StudyMaterial records to their notebooks.
 *
 * Usage: npx tsx scripts/backfill-notebooks.ts
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { prisma } = await import("../lib/prisma");

  console.log("🔍 Finding distinct (lineUserId, courseName) pairs...");

  const distinctPairs = await prisma.studyMaterial.findMany({
    where: { notebookId: null },
    distinct: ["lineUserId", "courseName"],
    select: { lineUserId: true, courseName: true }
  });

  console.log(`📚 Found ${distinctPairs.length} unique (user, course) pairs to backfill.\n`);

  let created = 0;
  let linked = 0;

  for (const { lineUserId, courseName } of distinctPairs) {
    const notebook = await prisma.notebook.upsert({
      where: {
        lineUserId_name: { lineUserId, name: courseName }
      },
      create: {
        lineUserId,
        name: courseName
      },
      update: {}
    });

    const result = await prisma.studyMaterial.updateMany({
      where: {
        lineUserId,
        courseName,
        notebookId: null
      },
      data: {
        notebookId: notebook.id
      }
    });

    if (result.count > 0) {
      console.log(`  ✅ ${courseName} (${lineUserId.slice(0, 8)}…) — ${result.count} notes linked`);
      linked += result.count;
    }

    created++;
  }

  console.log(`\n🎉 Done! Created/verified ${created} notebooks, linked ${linked} study materials.`);
}

main()
  .catch((error) => {
    console.error("❌ Backfill failed:", error);
    process.exit(1);
  });
