import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type CreateStudyMaterialInput = {
  courseName: string;
  lineUserId: string;
  notebookId?: string | null;
  rawText: string;
  sourceType: string;
  summary?: string | null;
  title?: string | null;
  keyPoints: Prisma.InputJsonValue;
  assignments: Array<{
    courseName: string;
    description: string | null;
    dueAt: Date | null;
    dueDateText: string | null;
    lineUserId: string;
    title: string;
  }>;
  chunks: Array<{
    chunkIndex: number;
    content: string;
    courseName: string;
    lineUserId: string;
  }>;
};

export class StudyMaterialRepository {
  async getUserCourses(lineUserId: string): Promise<string[]> {
    const materials = await prisma.studyMaterial.findMany({
      distinct: ["courseName"],
      orderBy: { createdAt: "desc" },
      select: { courseName: true },
      where: { lineUserId }
    });

    return materials.map((material) => material.courseName);
  }

  async getRecentMaterials(lineUserId: string, limit = 5) {
    return prisma.studyMaterial.findMany({
      where: { lineUserId },
      orderBy: { createdAt: "desc" },
      select: {
        courseName: true,
        createdAt: true,
        sourceType: true,
        summary: true,
        title: true
      },
      take: limit
    });
  }

  async findLatestMaterial(lineUserId: string, courseName?: string) {
    return prisma.studyMaterial.findFirst({
      where: {
        lineUserId,
        ...(courseName ? { courseName } : {})
      },
      orderBy: { createdAt: "desc" }
    });
  }

  async getAssignments(lineUserId: string, courseName?: string | null) {
    return prisma.assignment.findMany({
      where: {
        lineUserId,
        ...(courseName ? { courseName } : {})
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      take: 8
    });
  }

  async findChunks(lineUserId: string, courseName?: string | null) {
    return prisma.materialChunk.findMany({
      where: {
        lineUserId,
        ...(courseName ? { courseName } : {})
      },
      select: {
        content: true,
        courseName: true,
        material: {
          select: {
            title: true,
            summary: true,
            createdAt: true
          }
        }
      },
      take: 20
    });
  }

  async createMaterialWithChunksAndAssignments(data: CreateStudyMaterialInput) {
    return prisma.studyMaterial.create({
      data: {
        courseName: data.courseName,
        keyPoints: data.keyPoints,
        lineUserId: data.lineUserId,
        notebookId: data.notebookId ?? null,
        rawText: data.rawText,
        sourceType: data.sourceType,
        summary: data.summary,
        title: data.title,
        assignments: {
          create: data.assignments
        },
        chunks: {
          create: data.chunks
        }
      }
    });
  }
}

export const studyMaterialRepository = new StudyMaterialRepository();
