import { loadEnvConfig } from "@next/env";
import { buKnowledgeRecords } from "../src/data/bu-knowledge";

loadEnvConfig(process.cwd());

async function main() {
  const { prisma } = await import("../src/lib/prisma");

  for (const record of buKnowledgeRecords) {
    await prisma.knowledgeItem.upsert({
      where: { title: record.title },
      create: record,
      update: record
    });
  }

  console.log(`Seeded ${buKnowledgeRecords.length} BU StudyMate knowledge records.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("../src/lib/prisma");
    await prisma.$disconnect();
  });
