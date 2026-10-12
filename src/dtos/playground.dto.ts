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

export const TraceStatusSchema = z.enum(["applied", "fallback", "skipped", "error"]);
export const KnowledgeTraceDataSchema = z.object({
  originalQuery: z.string().max(7500).optional(),
  query: z.string().max(7500).optional(),
  model: z.string().optional(),
  tokens: z.number().int().nonnegative().optional(),
  keywordCount: z.number().int().nonnegative().max(20).optional(),
  vectorCount: z.number().int().nonnegative().max(20).optional(),
  chunks: z.array(z.object({
    id: z.string(), title: z.string(), sourceUrl: z.string(),
    content: z.string().max(2400).optional(),
    rank: z.number().int().positive(),
    selectedRank: z.number().int().positive().optional(),
    keywordRank: z.number().int().positive().nullable().optional(),
    vectorRank: z.number().int().positive().nullable().optional(),
    rrfScore: z.number().finite().nonnegative(),
    similarity: z.number().finite().min(-1).max(1).nullable()
  })).max(40).optional()
});
export type ExecutionLogEntry = {
  action: string;
  details?: string;
  durationMs?: number;
  status?: z.infer<typeof TraceStatusSchema>;
  rag?: z.infer<typeof KnowledgeTraceDataSchema>;
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
  executionLog: ExecutionLogEntry[];
};

export type PlaygroundConversation = PlaygroundSession & {
  messages: PlaygroundMessage[];
  runs: PlaygroundRun[];
};
