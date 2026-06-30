import env from "@next/env";
env.loadEnvConfig(process.cwd());
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const genericTitles = [
    "University Holidays",
    "Activity Registration",
    "Admissions Contact",
    "Library Information",
    "Student ID Card",
    "Classroom Building Information",
    "IT Support",
    "Scholarship Information",
    "General Contact Channels"
  ];
  
  const result = await prisma.knowledgeItem.deleteMany({
    where: {
      title: {
        in: genericTitles
      }
    }
  });
  
  console.log(`Deleted ${result.count} generic knowledge items.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
