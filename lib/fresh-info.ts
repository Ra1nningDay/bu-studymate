import { createWebSearchResponse, type AnswerSource } from "@/lib/ai";
import { formatUnverifiedBuReply } from "@/src/presenters/chat-policy.presenter";

const calendarQueryPattern =
  /(academic\s*calendar|calendar|holiday|ปฏิทิน|วันหยุด|วันหยุดมหาวิทยาลัย)/i;
const calendarSourcePattern =
  /(academic[-_\s]*calendar|calendar|holiday|ปฏิทิน|วันหยุด)/i;
const maxFreshInfoSources = 3;

export type FreshInfoAnswer = {
  sources: AnswerSource[];
  text: string;
  usedWebSearch: boolean;
  usage?: { total_tokens: number };
  model?: string;
};

function extractYears(text: string) {
  return Array.from(text.matchAll(/\b(20\d{2})\b/g), (match) => Number(match[1]));
}

function isCalendarSource(source: AnswerSource) {
  return calendarSourcePattern.test(`${source.title} ${source.url}`);
}

function sourceYear(source: AnswerSource) {
  const years = extractYears(`${source.title} ${source.url}`);
  return years.length > 0 ? Math.max(...years) : undefined;
}

function uniqueByUrl(sources: AnswerSource[]) {
  const seen = new Set<string>();
  return sources.filter((source) => {
    if (seen.has(source.url)) {
      return false;
    }

    seen.add(source.url);
    return true;
  });
}

function selectLatestCalendarSources(message: string, sources: AnswerSource[]) {
  const calendarSources = sources.filter(isCalendarSource);
  if (calendarSources.length === 0) {
    return [];
  }

  const requestedYears = new Set(extractYears(message));
  const targetYear =
    requestedYears.size > 0
      ? Math.max(...requestedYears)
      : Math.max(...calendarSources.map((source) => sourceYear(source) ?? 0));

  const eligibleSources =
    targetYear > 0
      ? calendarSources.filter((source) => {
          const year = sourceYear(source);
          return year ? year === targetYear : false;
        })
      : calendarSources;

  return (eligibleSources.length > 0 ? eligibleSources : calendarSources)
    .slice()
    .sort((left, right) => (sourceYear(right) ?? 0) - (sourceYear(left) ?? 0))
    .slice(0, maxFreshInfoSources);
}

export function compactFreshInfoSources(message: string, sources: AnswerSource[]) {
  const uniqueSources = uniqueByUrl(sources);

  if (calendarQueryPattern.test(message)) {
    const calendarSources = selectLatestCalendarSources(message, uniqueSources);
    return calendarSources.length > 0
      ? calendarSources
      : uniqueSources.slice(0, maxFreshInfoSources);
  }

  return uniqueSources.slice(0, maxFreshInfoSources);
}

export async function answerFreshInfoFromVerifiedSources(
  message: string,
  history?: Array<{ content: string; role: "assistant" | "user" }>
): Promise<FreshInfoAnswer> {
  const response = await createWebSearchResponse({
    history,
    message,
    options: { requireOfficialBuSources: true },
    toolType: "web_search_preview"
  });

  if (!response || !response.text || response.text.includes("VERIFIED_SOURCE_NOT_FOUND")) {
    return {
      sources: [],
      text: formatUnverifiedBuReply(message),
      usedWebSearch: true
    };
  }

  return {
    sources: compactFreshInfoSources(message, response.sources),
    text: response.text,
    usedWebSearch: true,
    usage: response.usage,
    model: response.model
  };
}

export const freshInfoTestInternals = {};
