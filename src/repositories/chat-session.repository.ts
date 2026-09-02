import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export class ChatSessionRepository {
  async findByLineUserId(lineUserId: string) {
    return prisma.chatSession.findUnique({
      where: { lineUserId }
    });
  }

  async create(lineUserId: string) {
    return prisma.chatSession.create({
      data: { lineUserId }
    });
  }

  async update(
    lineUserId: string,
    data: {
      state?: string;
      draftData?: Prisma.InputJsonValue;
    }
  ) {
    return prisma.chatSession.update({
      where: { lineUserId },
      data: {
        ...(data.state !== undefined ? { state: data.state } : {}),
        ...(data.draftData !== undefined ? { draftData: data.draftData } : {})
      }
    });
  }
}

export const chatSessionRepository = new ChatSessionRepository();
