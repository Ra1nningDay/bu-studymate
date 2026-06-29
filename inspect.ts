import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const latestRun = await prisma.botRun.findFirst({
    orderBy: { createdAt: 'desc' }
  });
  console.log(JSON.stringify(latestRun?.metadata, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
