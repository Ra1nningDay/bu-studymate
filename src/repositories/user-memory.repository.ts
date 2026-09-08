import { prisma } from "@/lib/prisma";

export class UserMemoryRepository {
  async upsertMemory(lineUserId: string, key: string, value: string, source: string = "inferred") {
    return prisma.userMemory.upsert({
      where: {
        lineUserId_key: { lineUserId, key }
      },
      create: {
        lineUserId,
        key,
        value,
        source
      },
      update: {
        value,
        source
      }
    });
  }

  async getMemories(lineUserId: string) {
    return prisma.userMemory.findMany({
      where: { lineUserId },
      orderBy: { updatedAt: "desc" }
    });
  }

  async getMemory(lineUserId: string, key: string) {
    return prisma.userMemory.findUnique({
      where: {
        lineUserId_key: { lineUserId, key }
      }
    });
  }

  async deleteMemory(lineUserId: string, key: string) {
    return prisma.userMemory.deleteMany({
      where: { lineUserId, key }
    });
  }
}

export const userMemoryRepository = new UserMemoryRepository();
