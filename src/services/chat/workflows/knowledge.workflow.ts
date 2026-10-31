import type { KnowledgeService } from "@/src/services/knowledge.service";
import type { ExecutionLogEntry } from "@/src/dtos/playground.dto";
import type { BotReply } from "../chat-contracts";
import { asReply } from "../chat-reply";
import { executeFreshInfoWorkflow, type BuLinksLookupFn } from "./fresh-info.workflow";

export async function executeKnowledgeWorkflow({
  trimmedMessage, history, executionLog, streamHooks
}: {
  trimmedMessage: string;
  history: Array<{ content: string; role: "assistant" | "user" }>;
  executionLog: ExecutionLogEntry[];
  streamHooks?: { onTextDelta?: (delta: string) => void; onTextReset?: () => void };
}, knowledgeSvc: KnowledgeService, buLinksLookup?: BuLinksLookupFn): Promise<BotReply> {
  let reply: BotReply;
  const knowledgeAnswer = await knowledgeSvc.answerQuestion(trimmedMessage, history, streamHooks);
  executionLog.push(...(knowledgeAnswer.trace ?? []));
  if (knowledgeAnswer.isMiss) {
    executionLog.push({ action: "Knowledge Base Miss - Falling back to Web Search" });
    reply = await executeFreshInfoWorkflow(trimmedMessage, history, executionLog, buLinksLookup, streamHooks);
    if (knowledgeAnswer.usage && reply.usage) {
      reply.usage = { total_tokens: reply.usage.total_tokens + knowledgeAnswer.usage.total_tokens };
    } else if (knowledgeAnswer.usage) {
      reply.usage = knowledgeAnswer.usage;
    }
  } else {
    reply = asReply(
      knowledgeAnswer.text,
      knowledgeAnswer.sources,
      knowledgeAnswer.usage,
      knowledgeAnswer.model,
      undefined,
      executionLog
    );
  }
  if (knowledgeAnswer.usageEntries) reply.usageEntries = [...knowledgeAnswer.usageEntries, ...(reply.usageEntries ?? [])];
  if (!reply.executionLog) reply.executionLog = executionLog;
  return reply;
}
