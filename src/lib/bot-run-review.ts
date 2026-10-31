import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { analyticsDateRange } from "@/lib/analytics-date-range";

export type BotRunReviewFilters = {
  from?: string | null;
  to?: string | null;
  channel?: string | null;
  intent?: string | null;
  status?: string | null;
  target?: string | null;
  usedWebSearch?: string | null;
};

export type BotRunReviewItem = {
  assistantMessage: {
    content: string;
    createdAt: string;
    sourceUrls: string[];
  } | null;
  createdAt: string;
  errorCode: string | null;
  id: string;
  intent: string | null;
  latencyMs: number | null;
  lineUserId: string;
  metadata: {
    channel: string | null;
    needsWebSearch: boolean | null;
    routerConfidence: number | null;
    routerReason: string | null;
    routerType: string | null;
    selectedTarget: string | null;
    executionLog?: any[] | null;
  };
  status: string;
  usedOpenAI: boolean;
  usedStudyMemory: boolean;
  usedTicketFlow: boolean;
  usedWebSearch: boolean;
  userMessage: {
    content: string;
    createdAt: string;
  } | null;
  tokensUsed?: number | null;
  modelName?: string | null;
  routerModel?: string | null;
  responseModel?: string | null;
};

function asObject(value: Prisma.JsonValue): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function readString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" ? value : null;
}

function readNumber(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "number" ? value : null;
}

function readBoolean(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "boolean" ? value : null;
}

function readStringArray(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function isActiveFilter(value?: string | null) {
  return Boolean(value && value !== "all");
}

export async function listBotRunReviews(filters: BotRunReviewFilters = {}, page: number = 1, limit: number = 50) {
  const where: Prisma.BotRunWhereInput = {};
  if (filters.from || filters.to) {
    const range = analyticsDateRange({ from: filters.from ?? undefined, to: filters.to ?? undefined });
    if (range.error) throw new Error(range.error);
    where.createdAt = { gte: range.start, lt: range.end };
  }

  if (isActiveFilter(filters.status)) {
    where.status = filters.status ?? undefined;
  }

  if (isActiveFilter(filters.intent)) {
    where.intent = filters.intent ?? undefined;
  }

  if (filters.usedWebSearch === "true") {
    where.usedWebSearch = true;
  } else if (filters.usedWebSearch === "false") {
    where.usedWebSearch = false;
  }

  const andConditions: Prisma.BotRunWhereInput[] = [];
  if (isActiveFilter(filters.channel)) {
    andConditions.push({
      metadata: {
        path: ["channel"],
        equals: filters.channel as string
      }
    });
  }
  if (isActiveFilter(filters.target)) {
    andConditions.push({
      metadata: {
        path: ["selectedTarget"],
        equals: filters.target as string
      }
    });
  }
  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  const skip = (page - 1) * limit;

  const [runs, totalCount] = await Promise.all([
    prisma.botRun.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      where
    }),
    prisma.botRun.count({ where })
  ]);

  const messageIds = Array.from(
    new Set(
      runs
        .flatMap((run) => [run.userMessageId, run.assistantMessageId])
        .filter((id): id is string => Boolean(id))
    )
  );

  const messages = messageIds.length
    ? await prisma.chatMessage.findMany({
        where: { id: { in: messageIds } }
      })
    : [];
  const messagesById = new Map(messages.map((message) => [message.id, message]));

  const items = runs
    .map((run): BotRunReviewItem => {
      const runMetadata = asObject(run.metadata);
      const userMessage = run.userMessageId
        ? messagesById.get(run.userMessageId) ?? null
        : null;
      const assistantMessage = run.assistantMessageId
        ? messagesById.get(run.assistantMessageId) ?? null
        : null;
      const assistantMetadata = assistantMessage
        ? asObject(assistantMessage.metadata)
        : {};

      return {
        assistantMessage: assistantMessage
          ? {
              content: assistantMessage.content,
              createdAt: assistantMessage.createdAt.toISOString(),
              sourceUrls: readStringArray(assistantMetadata, "sourceUrls")
            }
          : null,
        createdAt: run.createdAt.toISOString(),
        errorCode: run.errorCode,
        id: run.id,
        intent: run.intent,
        latencyMs: run.latencyMs,
        lineUserId: run.lineUserId,
        metadata: {
          channel: readString(runMetadata, "channel"),
          needsWebSearch: readBoolean(runMetadata, "needsWebSearch"),
          routerConfidence: readNumber(runMetadata, "routerConfidence"),
          routerReason: readString(runMetadata, "routerReason"),
          routerType: readString(runMetadata, "routerType"),
          selectedTarget: readString(runMetadata, "selectedTarget"),
          executionLog: runMetadata.executionLog as any[] | undefined
        },
        status: run.status,
        usedOpenAI: run.usedOpenAI,
        usedStudyMemory: run.usedStudyMemory,
        usedTicketFlow: run.usedTicketFlow,
        usedWebSearch: run.usedWebSearch,
        userMessage: userMessage
          ? {
              content: userMessage.content,
              createdAt: userMessage.createdAt.toISOString()
            }
          : null,
        tokensUsed: readNumber(runMetadata, "tokensUsed"),
        modelName: readString(runMetadata, "modelName"),
        routerModel: readString(runMetadata, "routerModel"),
        responseModel: readString(runMetadata, "responseModel")
      };
    });

  return { items, totalCount };
}
