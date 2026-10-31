import { generateGeneralChatReply } from "@/src/lib/ai/general-chat";
import { formatOutOfScopeReply } from "@/src/presenters/chat-policy.presenter";
import type { ExecutionLogEntry } from "@/src/dtos/playground.dto";
import type { BotReply, ResolvedRoute } from "../chat-contracts";
import { asReply } from "../chat-reply";

export async function executeGeneralChatWorkflow({
  route, trimmedMessage, history, executionLog, onTextDelta
}: {
  route: ResolvedRoute;
  trimmedMessage: string;
  history: Array<{ content: string; role: "assistant" | "user" }>;
  executionLog: ExecutionLogEntry[];
  onTextDelta?: (delta: string) => void;
}): Promise<BotReply> {
  const { intent } = route;
  let reply: BotReply;
  if (intent === "OUT_OF_SCOPE") {
    executionLog.push({ action: "Out-of-scope Boundary Reply" });
    reply = asReply(
      formatOutOfScopeReply(trimmedMessage),
      undefined,
      undefined,
      undefined,
      undefined,
      executionLog
    );
  } else {
    const actionName = intent === "UNKNOWN" ? "Generate Clarification Question (OpenAI)" : "Generate General Chat Reply (OpenAI)";
    const chatStarted = performance.now();
    const aiResponse = await generateGeneralChatReply(trimmedMessage, history, {
      onTextDelta,
      policy: intent === "UNKNOWN" ? "clarification" : "general",
      safetyCritical: route.safetyCritical
    });
    executionLog.push({
      action: actionName,
      status: "applied",
      durationMs: Math.round(performance.now() - chatStarted),
      details: aiResponse.model ? `Model: ${aiResponse.model}` : undefined
    });
    reply = asReply(
      aiResponse.text,
      undefined,
      aiResponse.usage,
      aiResponse.model,
      undefined,
      executionLog
    );
  }
  return reply;
}
