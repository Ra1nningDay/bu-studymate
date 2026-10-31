import { z } from "zod";

export const ChatRequestSchema = z.object({
  message: z.string().trim().min(1, "Message is required"),
  sessionId: z.string().trim().optional()
});

export type ChatRequestDto = z.infer<typeof ChatRequestSchema>;

export type AnswerSourceDto = {
  title: string;
  url: string;
};

export type ChatResponseDto = {
  aiConfigured: boolean;
  reply: string;
  flexMessage?: any;
  sources?: AnswerSourceDto[];
  usedWebSearch?: boolean;
  quickReply?: any;
};

export type SavedStudyFileDto = {
  aiConfigured: boolean;
  fileName: string;
  note: {
    courseName: string;
    summary: string | null;
    keyPoints: string[];
    assignments: Array<{
      title: string;
      dueDateText: string | null;
    }>;
  };
  pageCount?: number;
  sourceType: string;
  usedOcr: boolean;
  warnings: string[];
};
