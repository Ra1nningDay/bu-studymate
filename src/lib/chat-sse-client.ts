export class SseStreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SseStreamError";
  }
}

export type ChatSseSource = {
  title?: string;
  url: string;
};

export type ChatSseHandlers<TDone> = {
  onDelta?: (delta: string) => void;
  onDone?: (payload: TDone) => void;
  onReplace?: (text: string, sources: ChatSseSource[]) => void;
  onReset?: () => void;
};

export async function consumeChatSseResponse<TDone>(
  response: Response,
  handlers: ChatSseHandlers<TDone>
): Promise<TDone> {
  if (!response.body) {
    throw new SseStreamError("ไม่สามารถรับข้อมูลแบบต่อเนื่องได้");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let donePayload: TDone | undefined;
  let receivedDone = false;

  const processBlock = (block: string) => {
    let eventName = "message";
    const dataLines: string[] = [];

    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith("event:")) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line[5] === " " ? line.slice(6) : line.slice(5));
      }
    }

    if (!dataLines.length) return;
    const rawData = dataLines.join("\n");
    const parsed = JSON.parse(rawData) as Record<string, unknown>;

    if (eventName === "delta") {
      if (typeof parsed.delta === "string" && parsed.delta.length > 0) {
        handlers.onDelta?.(parsed.delta);
      }
    } else if (eventName === "reset") {
      handlers.onReset?.();
    } else if (eventName === "replace") {
      const text = typeof parsed.text === "string" ? parsed.text : "";
      const rawSources = Array.isArray(parsed.sources) ? parsed.sources : [];
      const sources: ChatSseSource[] = rawSources
        .map((item) => {
          if (typeof item === "string") return { url: item };
          if (item && typeof item === "object" && typeof (item as { url?: unknown }).url === "string") {
            return {
              title: typeof (item as { title?: unknown }).title === "string" ? (item as { title: string }).title : undefined,
              url: (item as { url: string }).url
            };
          }
          return null;
        })
        .filter((item): item is ChatSseSource => Boolean(item));
      handlers.onReplace?.(text, sources);
    } else if (eventName === "done") {
      donePayload = parsed as unknown as TDone;
      receivedDone = true;
      handlers.onDone?.(donePayload);
    } else if (eventName === "error") {
      const message = typeof parsed.error === "string" ? parsed.error : "ส่งข้อความไม่สำเร็จ";
      throw new SseStreamError(message);
    }
  };

  try {
    while (!receivedDone) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let match: RegExpExecArray | null;
      const boundary = /\r?\n\r?\n/;
      while (!receivedDone && (match = boundary.exec(buffer)) !== null) {
        const block = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        processBlock(block);
      }
    }

    buffer += decoder.decode();
    if (!receivedDone && buffer.trim()) {
      processBlock(buffer);
    }
  } finally {
    reader.releaseLock();
  }

  if (!receivedDone || donePayload === undefined) {
    throw new SseStreamError("การเชื่อมต่อสิ้นสุดก่อนได้รับคำตอบครบถ้วน");
  }

  return donePayload;
}
