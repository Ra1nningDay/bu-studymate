import type { ChatResponseDto } from "@/src/dtos/chat.dto";
import type { RateLimitResult } from "@/lib/rate-limit";
import { formatRateLimitMessage } from "@/lib/rate-limit";

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
