import type { ChatResponseDto } from "@/src/dtos/chat.dto";
import {
  formatRateLimitMessage,
  type RateLimitResult
} from "@/src/services/rate-limit.service";

export class ChatResponsePresenter {
  formatWebChatSuccess({
    aiConfigured,
    reply,
    flexMessage,
    sources = [],
    usedWebSearch = false,
    quickReply
  }: {
    aiConfigured: boolean;
    reply: string;
    flexMessage?: any;
    sources?: Array<{ title: string; url: string }>;
    usedWebSearch?: boolean;
    quickReply?: any;
  }): ChatResponseDto {
    return {
      aiConfigured,
      reply,
      flexMessage,
      sources,
      usedWebSearch,
      quickReply
    };
  }

  formatRateLimitError(result: RateLimitResult) {
    return {
      error: formatRateLimitMessage(result),
      retryAfterSeconds: result.retryAfterSeconds ?? 60
    };
  }
}

export const chatResponsePresenter = new ChatResponsePresenter();
