import { prisma } from "@/lib/prisma";

export class KnowledgeRepository {
  async listKnowledgeItems(take = 100) {
    return prisma.knowledgeItem.findMany({
      take,
      orderBy: { updatedAt: "desc" }
    });
  }

  async findById(id: string) {
    return prisma.knowledgeItem.findUnique({
      where: { id }
    });
  }
}

export const knowledgeRepository = new KnowledgeRepository();
