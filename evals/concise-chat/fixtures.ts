import type { ChatSession } from "@/lib/types";
import type { ChatLogRepository, CreateChatMessageData, CreateBotRunData, UpdateBotRunData } from "@/src/repositories/chat-log.repository";
import type { TicketService } from "@/src/services/ticket.service";
import type { StudyMemoryService } from "@/src/services/study-memory.service";
import type { KnowledgeService } from "@/src/services/knowledge.service";

import type { BuLinksLookupFn } from "@/lib/fresh-info";

export type ConversationMessage = { content: string; role: "assistant" | "user" };

// Synthetic fixtures isolate persistence and operational writes; routing and AI generation stay real.
export async function createConciseChatFixture(options: {
  history?: ConversationMessage[];
  knowledgeMiss?: boolean;
  workflowReply?: string;
  knowledgeService?: KnowledgeService;
  buLinksLookup?: BuLinksLookupFn;
} = {}) {
  const { ChatOrchestrationService } = await import("@/src/services/chat-orchestration.service");
  const messages: CreateChatMessageData[] = [];
  const runs: CreateBotRunData[] = [];
  const updates: UpdateBotRunData[] = [];
  const historyRequests: Array<{ completed: boolean; limit?: number }> = [];
  const workflowCalls: string[] = [];
  const session: ChatSession = {
    id: "synthetic-session",
    line_user_id: "synthetic-eval-user",
    state: "IDLE",
    draft_data: {},
    created_at: "2026-10-03T00:00:00Z",
    updated_at: "2026-10-03T00:00:00Z"
  };
  const history = options.history ?? [];
  const logRepository = {
    getRecentChatHistory: async (_id: string, limit?: number) => {
      historyRequests.push({ completed: false, limit });
      return history;
    },
    getRecentCompletedChatHistory: async (_id: string, limit = 4) => {
      historyRequests.push({ completed: true, limit });
      return history.slice(-limit * 2);
    },
    createChatMessage: async (data: CreateChatMessageData) => {
      messages.push(data);
      return { id: `synthetic-message-${messages.length}` };
    },
    createBotRun: async (data: CreateBotRunData) => {
      runs.push(data);
      return { id: `synthetic-run-${runs.length}` };
    },
    updateBotRun: async (_id: string, data: UpdateBotRunData) => {
      updates.push(data);
      return { id: _id };
    }
  } as unknown as ChatLogRepository;
  const workflowReply = options.workflowReply ?? "Synthetic verified workflow response.";
  const tickets = {
    getOrCreateChatSession: async () => session,
    continueTicketFlow: async () => {
      workflowCalls.push("ticket");
      return { text: workflowReply };
    },
    getTicketByCode: async () => null
  } as unknown as TicketService;
  const study = {
    answerFromStudyMemory: async () => {
      workflowCalls.push("study_memory");
      return { text: workflowReply };
    }
  } as unknown as StudyMemoryService;
  const knowledge = {
    answerQuestion: async () => {
      workflowCalls.push("knowledge_base");
      return { text: workflowReply, isMiss: Boolean(options.knowledgeMiss) };
    }
  } as unknown as KnowledgeService;
  return {
    service: new ChatOrchestrationService(logRepository, tickets, study, options.knowledgeService ?? knowledge, undefined, options.buLinksLookup ?? (async () => null)),
    messages,
    runs,
    updates,
    historyRequests,
    workflowCalls
  };
}
