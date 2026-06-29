import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ChatChannel = "line" | "web";
export type ChatRole = "assistant" | "system" | "user";
export type BotRunStatus = "error" | "processing" | "success";

export type ChatHistoryMessage = {
  content: string;
  role: "assistant" | "user";
};

const MAX_HISTORY_MESSAGES = 50; // 25 turns × 2 messages (user + assistant)

type SafeMetadata = Record<string, boolean | number | string | null | string[]>;

const metadataKeyBlocklist = /api[-_]?key|token|secret|authorization|password|stack/i;

function sanitizeMetadata(metadata?: Record<string, unknown>): Prisma.InputJsonValue {
  if (!metadata) {
    return {};
  }

  const safe: SafeMetadata = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (metadataKeyBlocklist.test(key)) {
      continue;
    }

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      safe[key] = value;
      continue;
    }

    if (Array.isArray(value)) {
      if (value.every((item) => typeof item === "string")) {
        safe[key] = value.slice(0, 20);
      } else if (
        key === "executionLog" &&
        value.every(
          (item) =>
            typeof item === "object" && item !== null && "action" in item
        )
      ) {
        safe[key] = value as any;
      }
    }
  }

  return safe as Prisma.InputJsonValue;
}

export async function createChatMessageLog({
  channel,
  content,
  intent,
  lineUserId,
  metadata,
  role,
  sessionId
}: {
  channel: ChatChannel;
  content: string;
  intent?: string | null;
  lineUserId: string;
  metadata?: Record<string, unknown>;
  role: ChatRole;
  sessionId?: string | null;
}) {
  try {
    return await prisma.chatMessage.create({
      data: {
        channel,
        content,
        intent,
        lineUserId,
        metadata: sanitizeMetadata(metadata),
        role,
        sessionId
      }
    });
  } catch (error) {
    console.error("Chat message logging failed", error);
    return null;
  }
}

export async function createBotRunLog({
  intent,
  lineUserId,
  metadata,
  userMessageId
}: {
  intent?: string | null;
  lineUserId: string;
  metadata?: Record<string, unknown>;
  userMessageId?: string | null;
}) {
  try {
    return await prisma.botRun.create({
      data: {
        intent,
        lineUserId,
        metadata: sanitizeMetadata(metadata),
        status: "processing",
        userMessageId
      }
    });
  } catch (error) {
    console.error("Bot run logging failed", error);
    return null;
  }
}

export async function updateBotRunLog({
  assistantMessageId,
  errorCode,
  latencyMs,
  metadata,
  runId,
  status,
  usedOpenAI,
  usedStudyMemory,
  usedTicketFlow,
  usedWebSearch
}: {
  assistantMessageId?: string | null;
  errorCode?: string | null;
  latencyMs?: number | null;
  metadata?: Record<string, unknown>;
  runId?: string | null;
  status: BotRunStatus;
  usedOpenAI?: boolean;
  usedStudyMemory?: boolean;
  usedTicketFlow?: boolean;
  usedWebSearch?: boolean;
}) {
  if (!runId) {
    return null;
  }

  try {
    return await prisma.botRun.update({
      data: {
        assistantMessageId,
        errorCode,
        latencyMs,
        metadata: sanitizeMetadata(metadata),
        status,
        usedOpenAI: Boolean(usedOpenAI),
        usedStudyMemory: Boolean(usedStudyMemory),
        usedTicketFlow: Boolean(usedTicketFlow),
        usedWebSearch: Boolean(usedWebSearch)
      },
      where: { id: runId }
    });
  } catch (error) {
    console.error("Bot run update failed", error);
    return null;
  }
}

export async function getRecentChatHistory(
  lineUserId: string,
  limit = MAX_HISTORY_MESSAGES
): Promise<ChatHistoryMessage[]> {
  try {
    const rows = await prisma.chatMessage.findMany({
      orderBy: { createdAt: "desc" },
      select: { content: true, role: true },
      take: limit,
      where: {
        lineUserId,
        role: { in: ["user", "assistant"] }
      }
    });
    // Reverse to get chronological order (oldest first for OpenAI messages array)
    return rows
      .reverse()
      .map((r) => ({ content: r.content, role: r.role as "assistant" | "user" }));
  } catch {
    return [];
  }
}
