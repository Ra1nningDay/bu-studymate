const systemPrompt = `You are BU StudyMate, a friendly Bangkok University AI assistant.
Answer the student's question using only the provided context.
If the context does not contain the answer, say that you do not have enough verified information yet.
Do not invent official university policies, tuition fees, deadlines, requirements, or procedures.
For how-to questions, answer with a clear overview first, then practical numbered steps, troubleshooting notes, and official contact channels when present in the context.
Keep the answer helpful and readable for chat. Do not be so brief that important steps from the context are omitted.
Use plain chat text only: numbered lists and short labels are allowed, but do not use Markdown headings, bold markers, tables, or raw links.
Answer in Thai by default, unless the user asks in English.`;

export type AnswerSource = {
  title: string;
  url: string;
};

type WebSearchOptions = {
  requireOfficialBuSources?: boolean;
};

const officialBuHostnames = [
  "admission.bu.ac.th",
  "bu.ac.th",
  "bulinks.bu.ac.th",
  "contents.bu.ac.th",
  "faq.bu.ac.th",
  "library.bu.ac.th",
  "www.bu.ac.th"
];

export function isAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function isOfficialBuSource(url: string) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return officialBuHostnames.some((officialHost) => {
      return hostname === officialHost || hostname.endsWith(`.${officialHost}`);
    });
  } catch {
    return false;
  }
}

function isSpecificOfficialBuSource(url: string) {
  if (!isOfficialBuSource(url)) {
    return false;
  }

  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    const path = parsedUrl.pathname.replace(/\/+$/g, "").toLowerCase();

    // If it's a generic hostname, require a specific path (reject /, /th, /en)
    if (hostname === "bu.ac.th" || hostname === "www.bu.ac.th") {
      return Boolean(path && !["/en", "/th"].includes(path));
    }

    // For specific subdomains like admission.bu.ac.th, the root page itself is acceptable
    return true;
  } catch {
    return false;
  }
}

function cleanChatText(text: string) {
  return text
    .replace(/\n+\s*(Sources|แหล่งที่มา)\s*:?\s*[\s\S]*$/gi, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/\s*https?:\/\/[^\s)\]]+/g, "")
    .replace(/\s*\([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\)/g, "") // Strip (bu.ac.th) citations
    .replace(/\s*[-•]\s*$/g, "")
    .trim();
}

function uniqueSources(sources: AnswerSource[]) {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const url = source.url.replace(/[),.]+$/g, "");
    if (!url || url.includes("](") || seen.has(url)) {
      return false;
    }

    source.url = url;
    source.title = source.title.replace(/[,.]+$/g, "");
    seen.add(url);
    return true;
  });
}

async function fetchSource(url: string, method: "GET" | "HEAD") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    return await fetch(url, {
      method,
      redirect: "follow",
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function isReachableSource(url: string) {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    return false;
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return false;
  }

  try {
    const headResponse = await fetchSource(parsedUrl.toString(), "HEAD");
    if (headResponse.ok) {
      return true;
    }

    if (![403, 405].includes(headResponse.status)) {
      return false;
    }
  } catch {
    // Some sites block HEAD. Fall through to a small GET verification.
  }

  try {
    const getResponse = await fetchSource(parsedUrl.toString(), "GET");
    return getResponse.ok;
  } catch {
    return false;
  }
}

export async function verifyAnswerSources(sources: AnswerSource[]) {
  const unique = uniqueSources(
    sources.map((source) => ({
      title: source.title.trim() || source.url,
      url: source.url.trim()
    }))
  );

  const verified = await Promise.all(
    unique.map(async (source) => ((await isReachableSource(source.url)) ? source : null))
  );

  return verified.filter((source): source is AnswerSource => Boolean(source));
}

export async function verifyOfficialBuSources(sources: AnswerSource[]) {
  const officialSources = sources.filter((source) => isOfficialBuSource(source.url));
  return verifyAnswerSources(officialSources);
}

export async function verifyFreshInfoSources(sources: AnswerSource[]) {
  const specificOfficialSources = sources.filter((source) =>
    isSpecificOfficialBuSource(source.url)
  );
  return verifyAnswerSources(specificOfficialSources);
}

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

  return {
    sources: uniqueSources(sources),
    text: cleanChatText(text),
    usage: data.usage,
    model: data.model
  };
}

export async function createWebSearchResponse({
  history,
  message,
  options,
  toolType
}: {
  history?: Array<{ content: string; role: "assistant" | "user" }>;
  message: string;
  options?: WebSearchOptions;
  toolType: "web_search" | "web_search_preview";
}) {
  const apiKey = process.env.OPENAI_API_KEY;
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
      "You must cite EVERY piece of information. At the end of your response, provide an exhaustive list of ALL URLs you visited or used for context.\n\n" +
      styleRules
    : "When using web search, prefer official Bangkok University sources first. " +
      "Treat bu.ac.th, faq.bu.ac.th, admission.bu.ac.th, and other official BU subdomains as the most reliable sources. " +
      "If no reliable official source is found, say that the information should be verified with the university. " +
      "You must provide a comprehensive list of ALL URLs you visited or used as a Markdown list at the end of your answer.\n\n" +
      styleRules;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_WEB_SEARCH_MODEL || process.env.OPENAI_MODEL || "gpt-5.4-mini",
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
            "Current date: 2026-06-29.\n" +
            "Please perform a deep and thorough web search before answering. Prefer official Bangkok University pages and BU-hosted files. " +
            "You MUST explicitly write out a 'แหล่งที่มา:' section at the very end containing Markdown links to ALL pages you visited."
        }
      ],
      tools: [
        {
          type: toolType
        }
      ]
    })
  });

  const data = (await response.json()) as {
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
    usage?: { total_tokens: number };
    model?: string;
  };

  if (!response.ok) {
    throw new Error(data.error?.message || `OpenAI web search failed: ${response.status}`);
  }

  return extractResponseTextAndSources(data);
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

export async function generateGeneralChatReply(
  message: string,
  history: Array<{ content: string; role: "assistant" | "user" }> = []
) {
  const apiKey = process.env.OPENAI_API_KEY;
  const fallback =
    "สวัสดีครับ ผมคือ BU StudyMate ช่วยตอบข้อมูลทั่วไปของ BU และรับแจ้งปัญหาห้องเรียน/สิ่งอำนวยความสะดวกได้ครับ";

  if (!apiKey) {
    return { text: fallback, usage: undefined, model: undefined };
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
        {
          role: "user",
          content: `Student message:\n${message}\n\nNo verified knowledge context matched this message. If this is a greeting or casual message, respond naturally as BU StudyMate. If the student asks for official BU information that requires verification, say you do not have enough verified information yet and suggest asking a more specific question or contacting the relevant BU office.`
        }
      ]
    })
  });

  if (!response.ok) {
    console.error("OpenAI general chat failed", await response.text());
    return { text: fallback, usage: undefined, model: undefined };
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { total_tokens: number };
    model?: string;
  };

  const text = data.choices?.[0]?.message?.content?.trim();
  return {
    text: text ? cleanChatText(text) : fallback,
    usage: data.usage,
    model: data.model || process.env.OPENAI_MODEL || "gpt-4o-mini"
  };
}

export async function rewriteKnowledgeAnswer({
  history = [],
  question,
  context
}: {
  context: string;
  history?: Array<{ content: string; role: "assistant" | "user" }>;
  question: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { text: context, usage: undefined, model: undefined };
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
        {
          role: "user",
          content: `Question:\n${question}\n\nVerified context:\n${context}`
        }
      ]
    })
  });

  if (!response.ok) {
    console.error("OpenAI answer rewrite failed", await response.text());
    return { text: context, usage: undefined, model: undefined };
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { total_tokens: number };
    model?: string;
  };

  const text = data.choices?.[0]?.message?.content?.trim();
  return {
    text: text ? cleanChatText(text) : context,
    usage: data.usage,
    model: data.model || process.env.OPENAI_MODEL || "gpt-4o-mini"
  };
}
