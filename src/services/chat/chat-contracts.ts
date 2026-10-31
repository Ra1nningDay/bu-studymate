import type { AiTokenUsage, AiUsageEntry } from "@/src/dtos/ai-usage.dto";
import type { AnswerSource } from "@/src/lib/ai/types";
import type { AgentRouterDecision, RouteTarget } from "@/src/lib/router/agent-router";
import type { Intent } from "@/src/lib/router/intent";
import type { ChatChannel } from "@/src/repositories/chat-log.repository";
import type { ExecutionLogEntry } from "@/src/dtos/playground.dto";

export type BotReplyStreamCallbacks = {
  onTextDelta?: (delta: string) => void;
  onTextReplace?: (text: string, sources?: AnswerSource[]) => void;
  onTextReset?: () => void;
};

export type BotReplyInput = {
  channel?: ChatChannel;
  lineUserId: string;
  message: string;
  stream?: BotReplyStreamCallbacks;
};

export type BotReply = {
  runId?: string;
  sources?: AnswerSource[];
  text: string;
  flexMessage?: any;
  quickReply?: any;
  usedWebSearch?: boolean;
  usage?: AiTokenUsage;
  usageEntries?: AiUsageEntry[];
  model?: string;
  executionLog?: ExecutionLogEntry[];
};

type RouterType = AgentRouterDecision["routerType"] | "hard_guard";

export type ResolvedRoute = {
  guideAction?:
    | "UPLOAD_STUDY_MATERIAL"
    | "ASK_BU_INFO_GUIDE"
    | "REPORT_ISSUE_GUIDE"
    | "ASK_LATEST_STUDY_GUIDE";
  intent: Intent;
  needsWebSearch: boolean;
  resetRequested?: boolean;
  routerConfidence: number;
  routerReason: string;
  routerType: RouterType;
  selectedTarget: RouteTarget;
  safetyCritical?: boolean;
  usage?: AiTokenUsage;
  usageEntries?: AiUsageEntry[];
  model?: string;
};
