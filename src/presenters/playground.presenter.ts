import type { Prisma } from "@prisma/client";
import type { PlaygroundConversation, PlaygroundSession } from "@/src/dtos/playground.dto";
import type { PlaygroundRepository } from "@/src/repositories/playground.repository";

function object(value: Prisma.JsonValue): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function string(value: unknown) {
  return typeof value === "string" ? value : null;
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function presentPlaygroundSession(session: {
  lineUserId: string; createdAt: Date; state: string;
}): PlaygroundSession {
  return {
    sessionId: session.lineUserId.replace(/^web-chat-/, ""),
    createdAt: session.createdAt.toISOString(),
    state: session.state
  };
}

export function presentPlaygroundConversation(
  data: NonNullable<Awaited<ReturnType<PlaygroundRepository["getConversation"]>>>
): PlaygroundConversation {
  return {
    ...presentPlaygroundSession(data.session),
    messages: data.messages.map((message) => {
      const metadata = object(message.metadata);
      return {
        id: message.id,
        role: message.role,
        text: message.content,
        createdAt: message.createdAt.toISOString(),
        sources: Array.isArray(metadata.sourceUrls)
          ? metadata.sourceUrls.filter((url): url is string => typeof url === "string") : []
      };
    }),
    runs: data.runs.map((run) => {
      const metadata = object(run.metadata);
      const logs = Array.isArray(metadata.executionLog) ? metadata.executionLog : [];
      return {
        id: run.id,
        userMessageId: run.userMessageId,
        assistantMessageId: run.assistantMessageId,
        createdAt: run.createdAt.toISOString(),
        status: run.status,
        intent: run.intent,
        errorCode: run.errorCode,
        latencyMs: run.latencyMs,
        routerType: string(metadata.routerType),
        routerReason: string(metadata.routerReason),
        routerConfidence: number(metadata.routerConfidence),
        selectedTarget: string(metadata.selectedTarget),
        sessionState: string(metadata.sessionState),
        modelName: string(metadata.modelName),
        routerModel: string(metadata.routerModel),
        responseModel: string(metadata.responseModel),
        tokensUsed: number(metadata.tokensUsed),
        usedWebSearch: run.usedWebSearch,
        usedStudyMemory: run.usedStudyMemory,
        usedTicketFlow: run.usedTicketFlow,
        executionLog: logs.flatMap((entry) => {
          if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
          const action = string(entry.action);
          return action ? [{ action, ...(typeof entry.details === "string" ? { details: entry.details } : {}) }] : [];
        })
      };
    })
  };
}
