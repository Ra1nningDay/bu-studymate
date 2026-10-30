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
    usedWebSearch = false
  }: {
    aiConfigured: boolean;
    reply: string;
    flexMessage?: any;
    sources?: Array<{ title: string; url: string }>;
    usedWebSearch?: boolean;
  }): ChatResponseDto {
    return {
      aiConfigured,
      reply,
      flexMessage,
      sources,
      usedWebSearch
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
