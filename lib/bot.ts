/**
 * Facade for backward compatibility.
 * Core bot orchestration logic has been refactored to src/services/chat-orchestration.service.ts
 */
export {
  chatOrchestrationService,
  ChatOrchestrationService,
  type BotReply,
  type BotReplyInput,
  type ExecutionLogEntry
} from "@/src/services/chat-orchestration.service";

import {
  chatOrchestrationService,
  type BotReplyInput
} from "@/src/services/chat-orchestration.service";

export async function createBotReply(input: BotReplyInput) {
  return chatOrchestrationService.createBotReply(input);
}
