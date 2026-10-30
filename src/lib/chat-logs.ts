/**
 * Facade for backward compatibility.
 * Core chat logging data access has been refactored to src/repositories/chat-log.repository.ts
 */
export {
  chatLogRepository,
  ChatLogRepository,
  type ChatChannel,
  type ChatRole,
  type BotRunStatus
} from "@/src/repositories/chat-log.repository";

import {
  chatLogRepository,
  type ChatChannel,
  type ChatRole,
  type BotRunStatus
} from "@/src/repositories/chat-log.repository";
import type { Prisma } from "@prisma/client";

export type ChatHistoryMessage = {
  content: string;
  role: "assistant" | "user";
};

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
    return await chatLogRepository.createChatMessage({
      channel,
      content,
      intent,
      lineUserId,
      metadata: metadata as Prisma.InputJsonValue,
      role,
      sessionId
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
    return await chatLogRepository.createBotRun({
      intent,
      lineUserId,
      metadata: metadata as Prisma.InputJsonValue,
      status: "processing",
      userMessageId
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
    return await chatLogRepository.updateBotRun(runId, {
      assistantMessageId,
      errorCode,
      latencyMs,
      metadata: metadata as Prisma.InputJsonValue,
      status,
      usedOpenAI,
      usedStudyMemory,
      usedTicketFlow,
      usedWebSearch
    });
  } catch (error) {
    console.error("Bot run update failed", error);
    return null;
  }
}

export async function getRecentChatHistory(
  lineUserId: string,
  limit = 50
): Promise<ChatHistoryMessage[]> {
  try {
    return await chatLogRepository.getRecentChatHistory(lineUserId, limit);
  } catch {
    return [];
  }
}
