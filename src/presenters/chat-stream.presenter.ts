import { NextResponse } from "next/server";
import type { AnswerSource } from "@/src/lib/ai/types";
import type { BotReply, BotReplyStreamCallbacks } from "@/src/services/chat/chat-contracts";

export function wantsEventStream(request: Request): boolean {
  return Boolean(request.headers.get("accept")?.toLowerCase().includes("text/event-stream"));
}

export function formatSseFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function createSseChatResponse<TDone>({
  errorMessage,
  execute,
  formatDone
}: {
  errorMessage: string;
  execute: (callbacks: BotReplyStreamCallbacks) => Promise<BotReply>;
  formatDone: (reply: BotReply) => TDone;
}): NextResponse {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const enqueue = (event: string, payload: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(formatSseFrame(event, payload)));
        } catch {
          closed = true;
        }
      };

      try {
        const reply = await execute({
          onTextDelta: (delta) => {
            if (delta) enqueue("delta", { delta });
          },
          onTextReset: () => {
            enqueue("reset", {});
          },
          onTextReplace: (text, sources?: AnswerSource[]) => {
            enqueue("replace", {
              text,
              sources: sources ?? []
            });
          }
        });

        enqueue("done", formatDone(reply));
      } catch {
        enqueue("error", { error: errorMessage });
      } finally {
        if (!closed) {
          closed = true;
          controller.close();
        }
      }
    }
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "private, no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}
