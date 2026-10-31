import type { AiUsageEntry } from "@/src/dtos/ai-usage.dto";
import { isAiConfigured } from "@/src/lib/ai/config";
import type { Intent } from "@/src/lib/router/intent";
import { chatLogRepository, type ChatLogRepository } from "@/src/repositories/chat-log.repository";
import { knowledgeService, type KnowledgeService } from "@/src/services/knowledge.service";
import { studyMemoryService, type StudyMemoryService } from "@/src/services/study-memory.service";
import { lineFlexPresenter, type LineFlexPresenter } from "@/src/presenters/line-flex.presenter";
import { ticketService, type TicketService } from "@/src/services/ticket.service";
import { tokenUsageRepository, type TokenUsageRepository } from "@/src/repositories/token-usage.repository";
import type { ChatSession } from "@/src/lib/types";
import { chatGuides } from "@/src/presenters/chat-workflow.presenter";
import type { ExecutionLogEntry } from "@/src/dtos/playground.dto";
import type { BotReply, BotReplyInput, BotReplyStreamCallbacks, ResolvedRoute } from "./chat-contracts";
import { asReply } from "./chat-reply";
import { canResolveWithoutRouter, resolveRoute } from "./routing/chat-route";
import { executeFreshInfoWorkflow, type BuLinksLookupFn } from "./workflows/fresh-info.workflow";
import { executeKnowledgeWorkflow } from "./workflows/knowledge.workflow";
import { executeStudyWorkflow } from "./workflows/study.workflow";
import { executeTicketWorkflow } from "./workflows/ticket.workflow";
import { executeGeneralChatWorkflow } from "./workflows/general-chat.workflow";

function needsRawChatHistory(intent: Intent) {
  return intent === "ASK_BU_INFO" || intent === "ASK_FRESH_INFO";
}

function didUseStudyMemory(intent: Intent) {
  return ["ADD_STUDY_NOTE", "ASK_STUDY_MEMORY", "LIST_ASSIGNMENTS", "LIST_NOTEBOOKS", "VIEW_NOTEBOOK"].includes(intent);
}

function didUseTicketFlow(intent: Intent) {
  return ["CHECK_TICKET_STATUS", "CREATE_TICKET"].includes(intent);
}

function mightUseOpenAI(route: ResolvedRoute, usedWebSearch: boolean) {
  if (!isAiConfigured()) {
    return false;
  }

  if (route.routerType === "agent_router" || route.usage) {
    return true;
  }

  if (usedWebSearch) {
    return true;
  }

  return ["ADD_STUDY_NOTE", "ASK_BU_INFO", "ASK_STUDY_MEMORY", "GENERAL_CHAT", "UNKNOWN"].includes(
    route.intent
  );
}

export class ChatOrchestrationService {
  constructor(
    private chatLogRepo: ChatLogRepository = chatLogRepository,
    private ticketSvc: TicketService = ticketService,
    private studySvc: StudyMemoryService = studyMemoryService,
    private knowledgeSvc: KnowledgeService = knowledgeService,
    private flexPresenter: LineFlexPresenter = lineFlexPresenter,
    private buLinksLookup?: BuLinksLookupFn,
    private tokenUsageRepo: TokenUsageRepository = tokenUsageRepository
  ) {}

  private async recordUsageEntries(botRunId: string, entries: AiUsageEntry[]) {
    if (!entries.length) return;
    await this.tokenUsageRepo.recordUsages(entries.map(({ provider, model, step, usage }) => ({
      botRunId, provider, model, step, totalTokens: usage.total_tokens,
      promptTokens: usage.prompt_tokens, completionTokens: usage.completion_tokens,
      cachedTokens: usage.cached_tokens, costUsd: usage.cost, webSearchCalls: usage.web_search_calls
    }))).catch(error => console.error("Failed to record token usage logs:", error));
  }

  private async executeBotReply({
    history,
    lineUserId,
    route,
    routerMs,
    session,
    stream,
    trimmedMessage
  }: {
    history: Array<{ content: string; role: "assistant" | "user" }>;
    lineUserId: string;
    route: ResolvedRoute;
    routerMs: number;
    session: ChatSession;
    stream?: BotReplyStreamCallbacks;
    trimmedMessage: string;
  }): Promise<BotReply> {
    const { intent } = route;
    let reply: BotReply;
    let streamedText = "";
    const onTextDelta = stream?.onTextDelta
      ? (delta: string) => {
          streamedText += delta;
          stream.onTextDelta?.(delta);
        }
      : undefined;
    const onTextReset = stream?.onTextReset
      ? () => {
          streamedText = "";
          stream.onTextReset?.();
        }
      : undefined;
    const streamHooks = onTextDelta ? { onTextDelta, onTextReset } : undefined;

    const routerModel = route.model;
    const executionLog: ExecutionLogEntry[] = [
      {
        action: "Agent Router Decision",
        status: route.routerType === "agent_router" || route.routerType === "hard_guard" ? "applied" : "fallback",
        durationMs: routerMs,
        details: `Intent: ${route.intent}, Target: ${route.selectedTarget}${routerModel ? ` · Model: ${routerModel}` : ""}`
      }
    ];

    const isThai = /[\u0E00-\u0E7F]/.test(trimmedMessage);
    if (route.guideAction) {
      const guide = chatGuides[route.guideAction];
      executionLog.push({ ...guide.step });
      reply = asReply(guide.text, undefined, undefined, undefined, undefined, executionLog);
    } else if (route.resetRequested || intent === "CREATE_TICKET" || intent === "CHECK_TICKET_STATUS") {
      reply = await executeTicketWorkflow({ route, lineUserId, trimmedMessage, session, isThai, executionLog }, this.ticketSvc);
    } else if (intent === "ADD_STUDY_NOTE" || intent === "LIST_ASSIGNMENTS" || intent === "LIST_NOTEBOOKS" || intent === "VIEW_NOTEBOOK" || intent === "ASK_STUDY_MEMORY") {
      reply = await executeStudyWorkflow({ intent, lineUserId, trimmedMessage, isThai, executionLog, onTextDelta }, this.studySvc, this.flexPresenter);
    } else if (intent === "ASK_FRESH_INFO") {
      reply = await executeFreshInfoWorkflow(trimmedMessage, history, executionLog, this.buLinksLookup, streamHooks);
    } else if (intent === "ASK_BU_INFO") {
      reply = await executeKnowledgeWorkflow({ trimmedMessage, history, executionLog, streamHooks }, this.knowledgeSvc, this.buLinksLookup);
    } else {
      reply = await executeGeneralChatWorkflow({ route, trimmedMessage, history, executionLog, onTextDelta });
    }

    const outputStarted = performance.now();
    if (reply.sources && reply.sources.length > 0) {
      const uniqueSources = Array.from(new Set(reply.sources.map((s) => s.url)));
      const sourcesList = uniqueSources.map((url) => `- ${url}`).join("\n");
      reply.text += "\n\nแหล่งข้อมูล:\n" + sourcesList;
    }

    executionLog.push({ action: "Output", durationMs: Math.round(performance.now() - outputStarted),
      status: "applied", details: `เตรียมคำตอบพร้อม ${reply.sources?.length ?? 0} citations` });

    if (stream) {
      if (!streamedText) {
        stream.onTextDelta?.(reply.text);
        if (reply.sources?.length) {
          stream.onTextReplace?.(reply.text, reply.sources);
        }
      } else if (streamedText !== reply.text || (reply.sources?.length ?? 0) > 0) {
        if (reply.text.startsWith(streamedText) && !(reply.sources?.length)) {
          const suffix = reply.text.slice(streamedText.length);
          if (suffix) stream.onTextDelta?.(suffix);
        } else {
          stream.onTextReplace?.(reply.text, reply.sources);
        }
      }
    }

    return reply;
  }

  async createBotReply({
    channel = "line",
    lineUserId,
    message,
    stream
  }: BotReplyInput): Promise<BotReply> {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      const promptReply = "พิมพ์คำถามหรือรายละเอียดที่ต้องการให้ StudyMate ช่วยได้เลยครับ";
      stream?.onTextDelta?.(promptReply);
      return asReply(promptReply);
    }

    const startedAt = Date.now();
    const skipCompletedHistory = canResolveWithoutRouter(trimmedMessage);
    const [session, completedHistory] = await Promise.all([
      this.ticketSvc.getOrCreateChatSession(lineUserId),
      skipCompletedHistory
        ? Promise.resolve([] as Array<{ content: string; role: "assistant" | "user" }>)
        : this.chatLogRepo.getRecentCompletedChatHistory(lineUserId, 4)
    ]);

    const routeStarted = performance.now();
    const route = await resolveRoute({ history: completedHistory, session, trimmedMessage });
    const routerMs = Math.round(performance.now() - routeStarted);
    const intent = route.intent;
    const userMessageId = crypto.randomUUID();

    const [history, , run] = await Promise.all([
      route.guideAction || route.resetRequested
        ? Promise.resolve([] as Array<{ content: string; role: "assistant" | "user" }>)
        : intent === "GENERAL_CHAT" || intent === "UNKNOWN"
          ? Promise.resolve(completedHistory)
          : needsRawChatHistory(intent)
            ? this.chatLogRepo.getRecentChatHistory(lineUserId, 8, userMessageId)
            : Promise.resolve([] as Array<{ content: string; role: "assistant" | "user" }>),
      this.chatLogRepo.createChatMessage({
        id: userMessageId,
        channel,
        content: trimmedMessage,
        intent,
        lineUserId,
        metadata: {
          messageLength: trimmedMessage.length,
          needsWebSearch: route.needsWebSearch,
          routerConfidence: route.routerConfidence,
          routerReason: route.routerReason,
          routerType: route.routerType,
          selectedTarget: route.selectedTarget,
          safetyCritical: Boolean(route.safetyCritical),
          sessionState: session.state
        },
        role: "user",
        sessionId: session.id
      }),
      this.chatLogRepo.createBotRun({
        intent,
        lineUserId,
        metadata: {
          channel,
          needsWebSearch: route.needsWebSearch,
          routerConfidence: route.routerConfidence,
          routerReason: route.routerReason,
          routerType: route.routerType,
          selectedTarget: route.selectedTarget,
          safetyCritical: Boolean(route.safetyCritical),
          sessionState: session.state
        },
        userMessageId
      })
    ]);

    const routerEntries = route.usageEntries ?? (route.usage && route.model
      ? [{ provider: "openai", model: route.model, step: "router", usage: route.usage }] : []);
    try {
      const reply = await this.executeBotReply({
        history,
        lineUserId,
        route,
        routerMs,
        session,
        stream,
        trimmedMessage
      });

      const assistantMessageId = crypto.randomUUID();
      const replyEntries = reply.usageEntries ?? (reply.usage && reply.model
        ? [{ provider: "openai", model: reply.model, step: "answer", usage: reply.usage }] : []);
      const usageEntries = [...routerEntries, ...replyEntries];
      const totalTokens = usageEntries.reduce((sum, entry) => sum + entry.usage.total_tokens, 0);
      const finalModel = reply.model || route.model;

      await Promise.all([
        this.chatLogRepo.createChatMessage({
          id: assistantMessageId,
          channel,
          content: reply.text,
          intent,
          lineUserId,
          metadata: {
            replyLength: reply.text.length,
            sourceCount: reply.sources?.length ?? 0,
            sourceUrls: reply.sources?.map((source) => source.url) ?? [],
            usedWebSearch: Boolean(reply.usedWebSearch)
          },
          role: "assistant",
          sessionId: session.id
        }),
        this.chatLogRepo.updateBotRun(run!.id, {
          assistantMessageId,
          latencyMs: Date.now() - startedAt,
          metadata: {
            channel,
            needsWebSearch: route.needsWebSearch,
            routerConfidence: route.routerConfidence,
            routerReason: route.routerReason,
            routerType: route.routerType,
            routerModel: route.model,
            responseModel: reply.model,
            selectedTarget: route.selectedTarget,
            safetyCritical: Boolean(route.safetyCritical),
            replyLength: reply.text.length,
            sourceCount: reply.sources?.length ?? 0,
            tokensUsed: totalTokens > 0 ? totalTokens : undefined,
            sourceUrls: reply.sources?.map((source) => source.url) ?? [],
            modelName: finalModel,
            sessionState: session.state,
            executionLog: reply.executionLog
          },
          status: "success",
          usedOpenAI: mightUseOpenAI(route, Boolean(reply.usedWebSearch)),
          usedStudyMemory: didUseStudyMemory(intent),
          usedTicketFlow: didUseTicketFlow(intent),
          usedWebSearch: Boolean(reply.usedWebSearch)
        })
      ]);

      await this.recordUsageEntries(run!.id, usageEntries);

      return { ...reply, runId: run!.id };
    } catch (error) {
      if (run?.id) {
        await this.recordUsageEntries(run.id, routerEntries);
        await this.chatLogRepo.updateBotRun(run.id, {
          errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
          latencyMs: Date.now() - startedAt,
          metadata: {
            channel,
            needsWebSearch: route.needsWebSearch,
            routerConfidence: route.routerConfidence,
            routerReason: route.routerReason,
            routerType: route.routerType,
            selectedTarget: route.selectedTarget,
            sessionState: session.state,
            executionLog: route.intent
              ? [
                  {
                    action: "Error",
                    details: error instanceof Error ? error.message : "Unknown error"
                  }
                ]
              : undefined
          },
          status: "error",
          usedOpenAI: mightUseOpenAI(route, false),
          usedStudyMemory: didUseStudyMemory(intent),
          usedTicketFlow: didUseTicketFlow(intent),
          usedWebSearch: false
        });
      }

      throw error;
    }
  }
}

export const chatOrchestrationService = new ChatOrchestrationService();
