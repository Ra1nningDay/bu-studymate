import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ChatChannel = "line" | "web";
export type ChatRole = "assistant" | "system" | "user";
export type BotRunStatus = "error" | "processing" | "success";

export type CreateChatMessageData = {
  id?: string;
  channel: ChatChannel;
  content: string;
  intent?: string | null;
  lineUserId: string;
  metadata?: Prisma.InputJsonValue;
  role: ChatRole;
  sessionId?: string | null;
};

export type CreateBotRunData = {
  id?: string;
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
        ...(data.id ? { id: data.id } : {}),
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
        ...(data.id ? { id: data.id } : {}),
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

  async getRecentChatHistory(lineUserId: string, limit = 8, excludeMessageId?: string) {
    const rows = await prisma.chatMessage.findMany({
      where: {
        lineUserId,
        role: { in: ["user", "assistant"] },
        ...(excludeMessageId ? { id: { not: excludeMessageId } } : {})
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

  async getRecentCompletedChatHistory(lineUserId: string, turnLimit = 4) {
    if (turnLimit <= 0) return [];
    const safeLimit = Math.max(1, Math.trunc(turnLimit));
    const rows = await prisma.$queryRaw<Array<{ userContent: string; assistantContent: string }>>`
      WITH recent_runs AS (
        SELECT user_message_id, assistant_message_id, created_at, id
        FROM bot_runs
        WHERE line_user_id = ${lineUserId}
          AND status = 'success'
          AND user_message_id IS NOT NULL
          AND assistant_message_id IS NOT NULL
        ORDER BY created_at DESC, id DESC
        LIMIT ${safeLimit}
      )
      SELECT u.content AS "userContent", a.content AS "assistantContent"
      FROM recent_runs r
      JOIN chat_messages u ON u.id = r.user_message_id AND u.role = 'user'
      JOIN chat_messages a ON a.id = r.assistant_message_id AND a.role = 'assistant'
      ORDER BY r.created_at ASC, r.id ASC
    `;

    return rows.flatMap((row) => [
      { content: row.userContent, role: "user" as const },
      { content: row.assistantContent, role: "assistant" as const }
    ]);
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
