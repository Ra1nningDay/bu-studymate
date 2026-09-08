import { prisma } from "@/lib/prisma";

export class NotebookRepository {
  async findOrCreateByCourseName(lineUserId: string, courseName: string) {
    return prisma.notebook.upsert({
      where: {
        lineUserId_name: { lineUserId, name: courseName }
      },
      create: {
        lineUserId,
        name: courseName
      },
      update: {}
    });
  }

  async getNotebooksWithCounts(lineUserId: string) {
    const notebooks = await prisma.notebook.findMany({
      where: { lineUserId },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: {
          select: { materials: true }
        }
      }
    });

    return notebooks.map((notebook) => ({
      emoji: notebook.emoji,
      id: notebook.id,
      name: notebook.name,
      noteCount: notebook._count.materials,
      updatedAt: notebook.updatedAt
    }));
  }

  async getNotebookNotes(lineUserId: string, notebookName: string) {
    const notebook = await prisma.notebook.findUnique({
      where: {
        lineUserId_name: { lineUserId, name: notebookName }
      }
    });

    if (!notebook) {
      return [];
    }

    return prisma.studyMaterial.findMany({
      where: {
        lineUserId,
        notebookId: notebook.id
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        courseName: true,
        title: true,
        summary: true,
        sourceType: true,
        createdAt: true
      },
      take: 20
    });
  }

  async getUncategorizedCount(lineUserId: string) {
    return prisma.studyMaterial.count({
      where: {
        lineUserId,
        notebookId: null
      }
    });
  }
}

export const notebookRepository = new NotebookRepository();
