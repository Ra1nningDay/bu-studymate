import { aiTokenUsageSchema, type AiTokenUsage } from "@/src/dtos/ai-usage.dto";

export function isEventStreamResponse(response: Response): boolean {
  return Boolean(response.headers.get("content-type")?.toLowerCase().includes("text/event-stream"));
}

export async function readSseDataEvents(
  body: ReadableStream<Uint8Array>,
  onData: (payload: string) => void
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let doneSignal = false;

  const processBlock = (block: string) => {
    const dataLines: string[] = [];
    for (const rawLine of block.split(/\r?\n/)) {
      if (rawLine.startsWith("data:")) {
        dataLines.push(rawLine[5] === " " ? rawLine.slice(6) : rawLine.slice(5));
      }
    }
    if (!dataLines.length) return;
    const payload = dataLines.join("\n");
    if (payload.trim() === "[DONE]") {
      doneSignal = true;
      return;
    }
    onData(payload);
  };

  try {
    while (!doneSignal) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let match: RegExpExecArray | null;
      const boundary = /\r?\n\r?\n/;
      while (!doneSignal && (match = boundary.exec(buffer)) !== null) {
        const block = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        processBlock(block);
      }
    }
    buffer += decoder.decode();
    if (!doneSignal && buffer.trim()) {
      processBlock(buffer);
    }
  } finally {
    reader.releaseLock();
  }
}

export type StreamTokenUsage = AiTokenUsage;

export async function consumeChatCompletionStream(
  response: Response,
  onDelta?: (delta: string) => void
): Promise<{
  content: string;
  finishReason?: string;
  model?: string;
  usage?: StreamTokenUsage;
}> {
  if (!response.body) {
    return { content: "" };
  }

  let content = "";
  let finishReason: string | undefined;
  let model: string | undefined;
  let usage: StreamTokenUsage | undefined;

  await readSseDataEvents(response.body, (payload) => {
    let chunk: {
      choices?: Array<{
        delta?: { content?: string | null; refusal?: string | null };
        finish_reason?: string | null;
      }>;
      model?: string;
      usage?: {
        total_tokens?: number;
        prompt_tokens?: number;
        completion_tokens?: number;
        prompt_tokens_details?: { cached_tokens?: number };
      } | null;
    };
    try {
      chunk = JSON.parse(payload);
    } catch {
      return;
    }

    if (chunk.model) model = chunk.model;
    if (typeof chunk.usage?.total_tokens === "number") {
      usage = aiTokenUsageSchema.safeParse(chunk.usage).data;
    }
    const choice = chunk.choices?.[0];
    if (choice?.finish_reason) {
      finishReason = choice.finish_reason;
    }
    const delta = choice?.delta?.content;
    if (typeof delta === "string" && delta.length > 0) {
      content += delta;
      onDelta?.(delta);
    }
  });

  return { content, finishReason, model, usage };
}

function decodePartialJsonString(input: string, startQuoteIndex: number): { value: string; endIndex: number; closed: boolean } {
  let out = "";
  let i = startQuoteIndex + 1;
  while (i < input.length) {
    const ch = input[i];
    if (ch === "\"") {
      return { value: out, endIndex: i + 1, closed: true };
    }
    if (ch !== "\\") {
      out += ch;
      i += 1;
      continue;
    }
    if (i + 1 >= input.length) break;
    const esc = input[i + 1];
    if (esc === "\"" || esc === "\\" || esc === "/") {
      out += esc;
      i += 2;
    } else if (esc === "b") {
      out += "\b";
      i += 2;
    } else if (esc === "f") {
      out += "\f";
      i += 2;
    } else if (esc === "n") {
      out += "\n";
      i += 2;
    } else if (esc === "r") {
      out += "\r";
      i += 2;
    } else if (esc === "t") {
      out += "\t";
      i += 2;
    } else if (esc === "u") {
      if (i + 6 > input.length) break;
      const hex = input.slice(i + 2, i + 6);
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) break;
      const code = parseInt(hex, 16);
      if (code >= 0xd800 && code <= 0xdbff) {
        if (i + 12 > input.length) {
          if (i + 6 < input.length && input[i + 6] !== "\\") {
            out += String.fromCharCode(code);
            i += 6;
            continue;
          }
          break;
        }
        if (input.slice(i + 6, i + 8) === "\\u") {
          const lowHex = input.slice(i + 8, i + 12);
          if (/^[0-9a-fA-F]{4}$/.test(lowHex)) {
            const low = parseInt(lowHex, 16);
            if (low >= 0xdc00 && low <= 0xdfff) {
              out += String.fromCodePoint(((code - 0xd800) << 10) + (low - 0xdc00) + 0x10000);
              i += 12;
              continue;
            }
          }
        }
      }
      out += String.fromCharCode(code);
      i += 6;
    } else {
      out += esc;
      i += 2;
    }
  }
  return { value: out, endIndex: i, closed: false };
}

function skipWhitespace(input: string, index: number): number {
  let i = index;
  while (i < input.length && /\s/.test(input[i])) i += 1;
  return i;
}

function skipJsonValue(input: string, index: number): number {
  let i = skipWhitespace(input, index);
  if (i >= input.length) return -1;
  if (input[i] === "\"") {
    const str = decodePartialJsonString(input, i);
    return str.closed ? str.endIndex : -1;
  }
  if (input[i] === "[" || input[i] === "{") {
    let depth = 0;
    while (i < input.length) {
      const ch = input[i];
      if (ch === "\"") {
        const str = decodePartialJsonString(input, i);
        if (!str.closed) return -1;
        i = str.endIndex;
        continue;
      }
      if (ch === "[" || ch === "{") depth += 1;
      else if (ch === "]" || ch === "}") {
        depth -= 1;
        if (depth === 0) return i + 1;
      }
      i += 1;
    }
    return -1;
  }
  while (i < input.length && !/[\s,}\]]/.test(input[i])) i += 1;
  return i < input.length ? i : -1;
}

export function extractJsonAnswerPrefix(rawJson: string): string | null {
  let i = skipWhitespace(rawJson, 0);
  if (i >= rawJson.length || rawJson[i] !== "{") return null;
  i += 1;

  while (i < rawJson.length) {
    i = skipWhitespace(rawJson, i);
    if (i >= rawJson.length || rawJson[i] === "}") return null;
    if (rawJson[i] === ",") {
      i = skipWhitespace(rawJson, i + 1);
    }
    if (i >= rawJson.length || rawJson[i] !== "\"") return null;

    const key = decodePartialJsonString(rawJson, i);
    if (!key.closed) return null;
    i = skipWhitespace(rawJson, key.endIndex);
    if (i >= rawJson.length || rawJson[i] !== ":") return null;
    i = skipWhitespace(rawJson, i + 1);
    if (i >= rawJson.length) return null;

    if (key.value === "answer") {
      if (rawJson[i] !== "\"") return null;
      return decodePartialJsonString(rawJson, i).value;
    }

    const next = skipJsonValue(rawJson, i);
    if (next === -1) return null;
    i = next;
  }

  return null;
}

export type ResponsesApiPayload = {
  error?: { message?: string };
  output?: Array<{
    content?: Array<{
      annotations?: Array<{ title?: string; type?: string; url?: string }>;
      text?: string;
      type?: string;
    }>;
    type?: string;
  }>;
  output_text?: string;
  usage?: StreamTokenUsage & { input_tokens?: number; output_tokens?: number; input_tokens_details?: { cached_tokens?: number } };
  model?: string;
};

export async function consumeResponsesStream(
  response: Response,
  onDelta?: (delta: string) => void
): Promise<ResponsesApiPayload> {
  if (!response.body) {
    return { output_text: "" };
  }

  let outputText = "";
  let completed: ResponsesApiPayload | undefined;
  let model: string | undefined;
  let usage: StreamTokenUsage | undefined;

  await readSseDataEvents(response.body, (payload) => {
    let event: {
      type?: string;
      delta?: string;
      response?: ResponsesApiPayload & {
        usage?: {
          total_tokens?: number;
          prompt_tokens?: number;
          completion_tokens?: number;
          prompt_tokens_details?: { cached_tokens?: number };
        };
      };
    };
    try {
      event = JSON.parse(payload);
    } catch {
      return;
    }

    if (event.type === "response.output_text.delta" && typeof event.delta === "string" && event.delta.length > 0) {
      outputText += event.delta;
      onDelta?.(event.delta);
    } else if (event.type === "response.completed" && event.response) {
      completed = event.response;
    } else if (event.response) {
      if (event.response.model) model = event.response.model;
      if (event.response.usage) {
        const u = event.response.usage;
        usage = aiTokenUsageSchema.safeParse(u).data;
      }
    }
  });

  if (completed) {
    return {
      ...completed,
      usage: aiTokenUsageSchema.safeParse(completed.usage).data,
      output_text: completed.output_text ?? outputText
    };
  }

  return { output_text: outputText, model, usage };
}
