import type { AnswerSource } from "@/src/lib/ai/types";
import type { ExecutionLogEntry } from "@/src/dtos/playground.dto";
import type { BotReply } from "./chat-contracts";

export function asReply(
  text: string,
  sources?: AnswerSource[],
  usage?: {
    total_tokens: number;
    prompt_tokens?: number;
    completion_tokens?: number;
    cached_tokens?: number;
  },
  model?: string,
  flexMessage?: any,
  executionLog?: ExecutionLogEntry[]
): BotReply {
  return { text, sources, usage, model, flexMessage, executionLog };
}
