import { env } from "@/src/config/env";
import { aiTokenUsageSchema } from "@/src/dtos/ai-usage.dto";
import { consumeResponsesStream, isEventStreamResponse, type ResponsesApiPayload } from "@/src/lib/openai-stream";
import type { AnswerSource } from "./types";
import { uniqueSources } from "./answer-sources";
import { cleanChatText } from "./text";
import { systemPrompt, getCurrentBangkokDate } from "./context";

type WebSearchOptions = {
  requireOfficialBuSources?: boolean;
};

function extractSourcesFromText(text: string) {
  const sources: AnswerSource[] = [];
  const markdownLinkPattern = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  const rawUrlPattern = /https?:\/\/[^\s)\]]+/g;

  for (const match of text.matchAll(markdownLinkPattern)) {
    sources.push({
      title: match[1] || match[2],
      url: match[2]
    });
  }

  for (const match of text.matchAll(rawUrlPattern)) {
    sources.push({
      title: match[0],
      url: match[0]
    });
  }

  return sources;
}

function extractResponseTextAndSources(data: {
  output?: Array<{
    content?: Array<{
      annotations?: Array<{
        title?: string;
        type?: string;
        url?: string;
      }>;
      text?: string;
      type?: string;
    }>;
    type?: string;
  }>;
  output_text?: string;
  usage?: { total_tokens: number };
  model?: string;
}) {
  let text = data.output_text ?? "";
  const sources: AnswerSource[] = [];

  for (const item of data.output ?? []) {
    for (const content of item.content ?? []) {
      if (!text && content.type === "output_text" && content.text) {
        text = content.text;
      }

      for (const annotation of content.annotations ?? []) {
        if (annotation.url) {
          sources.push({
            title: annotation.title || annotation.url,
            url: annotation.url
          });
        }
      }
    }
  }

  sources.push(...extractSourcesFromText(text));
  const reportedUsage = aiTokenUsageSchema.safeParse(data.usage).data;
  const calls = data.output?.filter(item => item.type === "web_search_call").length;
  const usage = reportedUsage ? { ...reportedUsage, web_search_calls: calls }
    : calls != null ? { total_tokens: 0, web_search_calls: calls } : undefined;

  return { sources: uniqueSources(sources), text: cleanChatText(text), usage, model: data.model };

}

export async function createWebSearchResponse({
  history,
  message,
  onTextDelta,
  options,
  toolType
}: {
  history?: Array<{ content: string; role: "assistant" | "user" }>;
  message: string;
  onTextDelta?: (delta: string) => void;
  options?: WebSearchOptions;
  toolType: "web_search" | "web_search_preview";
}) {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const styleRules =
    "Style Guidelines:\n" +
    "- Be direct and concise. Answer the user's core question immediately in the very first sentence without unnecessary introductions or rambling.\n" +
    "- Always respond in the exact same language the user used in their query (e.g., Thai for Thai, English for English). Ensure a polite tone across all languages.\n" +
    "- When speaking Thai, use natural Thai vocabulary instead of English loanwords (e.g., use 'สถานที่' instead of 'location', 'สิ่งอำนวยความสะดวก' instead of 'facility'). You may keep proper nouns (like U Store, Main Campus) in English.\n" +
    "- Use a friendly university-assistant tone.\n" +
    "- Prefer clear 'friendly bullets' instead of dry bullet lists.\n" +
    "- Use light emojis only when appropriate, such as ✅ 📌 📝 🔗. Do not overuse emojis.\n" +
    "- Do not invent unsupported facts. Keep answers based only on validated official evidence.\n" +
    "- If details may vary by degree/program, say so politely.\n";

  const freshInfoRules = options?.requireOfficialBuSources
    ? "You must use web search and answer only from official Bangkok University sources or BU-hosted files. " +
      "Official sources include bu.ac.th, contents.bu.ac.th, bulinks.bu.ac.th, admission.bu.ac.th, faq.bu.ac.th, and library.bu.ac.th. " +
      "Do not answer from model memory or general Thai public-holiday knowledge. " +
      "Do not infer missing facts. Do not list holidays, dates, deadlines, fees, opening hours, or admission dates unless an official source explicitly states them. " +
      "If no official BU source directly supports the answer, reply exactly: VERIFIED_SOURCE_NOT_FOUND. " +
      "Cite only the official source or sources that directly support the final answer. Do not provide an exhaustive list of every URL visited. " +
      "Multiple source URLs are acceptable when they directly support different parts of the answer, but prefer the latest official version and exclude outdated duplicate documents. " +
      "For calendar, holiday, or academic-calendar questions, use the latest official calendar/holiday documents unless the user asks for a specific year.\n\n" +
      styleRules
    : "When using web search, prefer official Bangkok University sources first. " +
      "Treat bu.ac.th, faq.bu.ac.th, admission.bu.ac.th, and other official BU subdomains as the most reliable sources. " +
      "If no reliable official source is found, say that the information should be verified with the university. " +
      "Cite only the most relevant source URLs that directly support the answer. Prefer the latest official version and exclude outdated duplicate documents. Do not provide an exhaustive list of every URL visited.\n\n" +
      styleRules;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: env.OPENAI_WEB_SEARCH_MODEL || env.OPENAI_MODEL,
      input: [
        {
          role: "system",
          content: `${systemPrompt}\n${freshInfoRules}`
        },
        ...(history ?? []),
        {
          role: "user",
          content:
            `Question:\n${message}\n\n` +
            `Current date: ${getCurrentBangkokDate()}.\n` +
            "Search enough to verify the answer, then answer from the most directly relevant official Bangkok University page or BU-hosted file. " +
            "At the end, write a 'แหล่งที่มา:' section containing only the final source URL(s) that directly support the answer."
        }
      ],
      tools: [
        {
          type: toolType
        }
      ],
      ...(onTextDelta ? { stream: true } : {})
    }),
    signal: AbortSignal.timeout(45000)
  });

  if (!response.ok) {
    throw new Error(`OpenAI web search failed: ${response.status}`);
  }

  let data: ResponsesApiPayload;
  if (onTextDelta && isEventStreamResponse(response)) {
    const sentinel = "VERIFIED_SOURCE_NOT_FOUND";
    let rawAccumulated = "";
    let emittedLength = 0;
    let stoppedAtFooter = false;
    data = await consumeResponsesStream(response, (delta) => {
      rawAccumulated += delta;
      if (stoppedAtFooter || sentinel.startsWith(rawAccumulated) || rawAccumulated.includes(sentinel)) {
        return;
      }
      const footerMatch = /\n+\s*(?:Sources|แหล่งที่มา)\s*:?/i.exec(rawAccumulated);
      const visibleEnd = footerMatch ? footerMatch.index : rawAccumulated.length;
      if (footerMatch) {
        stoppedAtFooter = true;
      }
      if (visibleEnd > emittedLength) {
        onTextDelta(rawAccumulated.slice(emittedLength, visibleEnd));
        emittedLength = visibleEnd;
      }
    });
  } else {
    data = (await response.json()) as ResponsesApiPayload;
    const parsed = extractResponseTextAndSources(data);
    if (onTextDelta && parsed.text && !parsed.text.includes("VERIFIED_SOURCE_NOT_FOUND")) {
      onTextDelta(parsed.text);
    }
    return { ...parsed, model: parsed.model || env.OPENAI_WEB_SEARCH_MODEL || env.OPENAI_MODEL, step: toolType };
  }

  const parsed = extractResponseTextAndSources(data);
  return { ...parsed, model: parsed.model || env.OPENAI_WEB_SEARCH_MODEL || env.OPENAI_MODEL, step: toolType };
}

export async function answerWithWebSearch(
  message: string,
  options: WebSearchOptions = {}
) {
  try {
    const result = await createWebSearchResponse({
      message,
      options,
      toolType: "web_search_preview"
    });

    if (result?.text) {
      return result;
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown web_search_preview error";
    console.warn("OpenAI web_search_preview failed", message);
  }

  try {
    const result = await createWebSearchResponse({
      message,
      options,
      toolType: "web_search"
    });

    if (result?.text) {
      return result;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown web_search error";
    console.warn("OpenAI web_search failed", message);
  }

  return null;
}
