import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ChatChannel = "line" | "web";
export type ChatRole = "assistant" | "system" | "user";
export type BotRunStatus = "error" | "processing" | "success";

export type CreateChatMessageData = {
  channel: ChatChannel;
  content: string;
  intent?: string | null;
  lineUserId: string;
  metadata?: Prisma.InputJsonValue;
  role: ChatRole;
  sessionId?: string | null;
};

export type CreateBotRunData = {
  intent?: string | null;
  lineUserId: string;
  metadata?: Prisma.InputJsonValue;
  status?: string;
  userMessageId?: string | null;
};

export type UpdateBotRunData = {
  assistantMessageId?: string | null;
  errorCode?: string | null;
  latencyMs?: number | null;
  metadata?: Prisma.InputJsonValue;
  status: BotRunStatus;
  usedOpenAI?: boolean;
  usedStudyMemory?: boolean;
  usedTicketFlow?: boolean;
  usedWebSearch?: boolean;
};

export class ChatLogRepository {
  async createChatMessage(data: CreateChatMessageData) {
    return prisma.chatMessage.create({
      data: {
        channel: data.channel,
        content: data.content,
        intent: data.intent,
        lineUserId: data.lineUserId,
        metadata: data.metadata ?? {},
        role: data.role,
        sessionId: data.sessionId
      }
    });
  }

  async createBotRun(data: CreateBotRunData) {
    return prisma.botRun.create({
      data: {
        intent: data.intent,
        lineUserId: data.lineUserId,
        metadata: data.metadata ?? {},
        status: data.status ?? "processing",
        userMessageId: data.userMessageId
      }
    });
  }

  async updateBotRun(id: string, data: UpdateBotRunData) {
    return prisma.botRun.update({
      where: { id },
      data: {
        assistantMessageId: data.assistantMessageId,
        errorCode: data.errorCode,
        latencyMs: data.latencyMs,
        metadata: data.metadata,
        status: data.status,
        usedOpenAI: Boolean(data.usedOpenAI),
        usedStudyMemory: Boolean(data.usedStudyMemory),
        usedTicketFlow: Boolean(data.usedTicketFlow),
        usedWebSearch: Boolean(data.usedWebSearch)
      }
    });
  }

  async getRecentChatHistory(lineUserId: string, limit = 50) {
    const rows = await prisma.chatMessage.findMany({
      where: {
        lineUserId,
        role: { in: ["user", "assistant"] }
      },
      select: { content: true, role: true },
      orderBy: { createdAt: "desc" },
      take: limit
    });

    return rows.reverse().map((r) => ({
      content: r.content,
      role: r.role as "assistant" | "user"
    }));
  }

  async findMessagesByIds(ids: string[]) {
    if (ids.length === 0) return [];
    return prisma.chatMessage.findMany({
      where: { id: { in: ids } }
    });
  }

  async listBotRuns(limit = 100) {
    return prisma.botRun.findMany({
      orderBy: { createdAt: "desc" },
      take: limit
    });
  }
}

export const chatLogRepository = new ChatLogRepository();
