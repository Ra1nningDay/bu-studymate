import { randomUUID } from "node:crypto";
import { ChatOrchestrationService } from "@/src/services/chat/chat-orchestration.service";
import { KnowledgeService } from "@/src/services/knowledge.service";
import { TicketService } from "@/src/services/ticket.service";
import type { StudyMemoryService } from "@/src/services/study-memory.service";
import type { ChatLogRepository, CreateBotRunData, UpdateBotRunData } from "@/src/repositories/chat-log.repository";
import type { ChatSessionRepository } from "@/src/repositories/chat-session.repository";
import type { TicketRepository } from "@/src/repositories/ticket.repository";
import type { KnowledgeRepository } from "@/src/repositories/knowledge.repository";
import type { KnowledgeEvidence } from "@/src/repositories/knowledge.repository";

class ObservedKnowledgeService extends KnowledgeService {
  retrieved: KnowledgeEvidence[] = [];

  override async retrieve(...args: Parameters<KnowledgeService["retrieve"]>) {
    const result = await super.retrieve(...args);
    this.retrieved = result.items;
    return result;
  }
}

class P1OrchestrationProvider {
  id() {
    return "bu-studymate:p1-orchestration";
  }

  async callApi(prompt: string, context?: { vars?: { message?: string; knowledgeMode?: string } }) {
    const message = context?.vars?.message ?? prompt;
    const knowledgeMode = context?.vars?.knowledgeMode === "seed" ? "seed" : "database";
    const lineUserId = `eval-${randomUUID()}`;
    const now = new Date();
    const session = {
      id: randomUUID(),
      lineUserId,
      state: "IDLE",
      draftData: {},
      createdAt: now,
      updatedAt: now
    };
    let runUpdate: UpdateBotRunData | undefined;
    let runIntent: string | null | undefined;

    // The real orchestration runs with isolated in-memory persistence.
    const sessionRepo = {
      findByLineUserId: async () => session,
      create: async () => session,
      update: async (_id: string, data: { state?: string; draftData?: object }) => {
        if (data.state) session.state = data.state;
        if (data.draftData) session.draftData = data.draftData;
        return session;
      }
    } as unknown as ChatSessionRepository;
    const ticketRepo = {
      findByCode: async () => null,
      create: async () => { throw new Error("Ticket creation is disabled in evals"); }
    } as unknown as TicketRepository;
    const logRepo = {
      getRecentChatHistory: async () => [],
      getRecentCompletedChatHistory: async () => [],
      createChatMessage: async () => ({ id: randomUUID() }),
      createBotRun: async (data: CreateBotRunData) => {
        runIntent = data.intent;
        return { id: randomUUID() };
      },
      updateBotRun: async (_id: string, data: UpdateBotRunData) => {
        runUpdate = data;
        return { id: _id };
      }
    } as unknown as ChatLogRepository;

    const seedRepo = {
      // Demo seeds have no approval/source snapshot and must remain retrieval misses.
      hasIndexedEvidence: async () => false,
      hybridSearch: async () => []
    } satisfies Pick<KnowledgeRepository, "hybridSearch" | "hasIndexedEvidence">;
    const knowledge = new ObservedKnowledgeService(knowledgeMode === "seed" ? seedRepo : undefined);
    const studyService = new Proxy({} as StudyMemoryService, {
      get: () => { throw new Error("Study memory is disabled in P1 evals"); }
    });
    const orchestration = new ChatOrchestrationService(
      logRepo,
      new TicketService(ticketRepo, sessionRepo),
      studyService,
      knowledge,
      undefined,
      // Keep the eval hermetic: no live BU Links calls, so it measures the pre-existing paths only.
      async () => null
    );

    try {
      const reply = await orchestration.createBotReply({
        channel: "web",
        lineUserId,
        message
      });
      const metadata = runUpdate?.metadata;
      const selectedTarget = metadata && typeof metadata === "object" && "selectedTarget" in metadata
        ? metadata.selectedTarget
        : undefined;
      const output = {
        answer: reply.text,
        evaluatedAt: now.toISOString(),
        timeZone: "Asia/Bangkok",
        intent: runIntent,
        selectedTarget,
        usedWebSearch: Boolean(reply.usedWebSearch),
        sources: reply.sources ?? [],
        retrievedContext: knowledge.retrieved.map((item) => item.content).join("\n\n") || null,
        retrievedSource: knowledge.retrieved.map((item) => item.sourceUrl).join("\n") || null,
        executionLog: reply.executionLog ?? []
      };
      return {
        output,
        metadata: { knowledgeMode },
        tokenUsage: reply.usage ? { total: reply.usage.total_tokens } : undefined
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }
}

export default P1OrchestrationProvider;
