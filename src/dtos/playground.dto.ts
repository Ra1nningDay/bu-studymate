import { z } from "zod";

export const PlaygroundSessionIdSchema = z.string().regex(
  /^playground-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  "Invalid playground session"
);

export const PlaygroundMessageSchema = z.object({
  sessionId: PlaygroundSessionIdSchema,
  message: z.string().trim().min(1).max(10000)
});

export type PlaygroundMessageDto = z.infer<typeof PlaygroundMessageSchema>;

export type PlaygroundSession = {
  sessionId: string;
  createdAt: string;
  state: string;
};

export type PlaygroundMessage = {
  id: string;
  role: string;
  text: string;
  createdAt: string;
  sources: string[];
};

export type PlaygroundRun = {
  id: string;
  userMessageId: string | null;
  assistantMessageId: string | null;
  createdAt: string;
  status: string;
  intent: string | null;
  errorCode: string | null;
  latencyMs: number | null;
  routerType: string | null;
  routerReason: string | null;
  routerConfidence: number | null;
  selectedTarget: string | null;
  sessionState: string | null;
  modelName: string | null;
  routerModel?: string | null;
  responseModel?: string | null;
  tokensUsed: number | null;
  usedWebSearch: boolean;
  usedStudyMemory: boolean;
  usedTicketFlow: boolean;
  executionLog: Array<{ action: string; details?: string }>;
};

export type PlaygroundConversation = PlaygroundSession & {
  messages: PlaygroundMessage[];
  runs: PlaygroundRun[];
};
