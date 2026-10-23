import { buLinksClient, type BuLinksClient, type BuLinksPage } from "@/lib/bulinks";
import { tokenizeKnowledge } from "@/lib/knowledge-index";
import { officialKnowledgeUrlSchema } from "@/src/dtos/knowledge.dto";
import { formatAnnouncements, formatServiceLinks } from "@/src/presenters/bulinks.presenter";

export type BuLinksTopic = "announcement" | "student_affairs" | "study_abroad" | "news" | "calendar";
export type BuLinksLookup = { kind: "announcements" | "services"; text: string; links: Array<{ title: string; url: string }> };

const topicPatterns: Array<[BuLinksTopic, RegExp]> = [
  ["announcement", /ประกาศ|announce|เรียนออนไลน์|onsite|ออนไลน์|น้ำท่วม|หยุด|ปิดเรียน|เลื่อนสอบ|class|online|suspend|cancel/],
  ["student_affairs", /กิจการนักศึกษา|student affairs/],
  ["study_abroad", /แลกเปลี่ยน|study abroad|ต่างประเทศ|exchange/],
  ["news", /ข่าว|news/],
  ["calendar", /ปฏิทิน|calendar|events?\b/]
];
// announcement covers the general feed: university plus student affairs.
const categories = {
  th: { announcement: [1, 564], student_affairs: [564], study_abroad: [284] },
  en: { announcement: [24, 566], student_affairs: [566], study_abroad: [280] }
} as const;
const fixedLinks = {
  calendar: { th: "ปฏิทินกิจกรรม BU Links", en: "BU Links events calendar", url: "https://bulinks.bu.ac.th/events-calendar/" },
  news: { th: "BU NEWS", en: "BU NEWS", url: "https://www.bu.ac.th/th/featured-stories/type/5" }
} as const;

const stopWords = new Set(["ที่ไหน", "อย่างไร", "เท่าไร", "เท่าไหร่", "ยังไง", "ไหม", "ขอ", "ทำ", "how", "what", "where", "can", "the"]);
// Tuned on the 15 fixture titles: any one distinctive word (idf 2.2-3.1) passes, a stray very common word does not.
const minScore = 2.5;
// A page must also score at least this share of the best match, so a sibling sharing only a generic word (graduate vs bachelor tuition) is dropped.
const relativeCut = 0.6;
const hasThai = (text: string) => /[฀-๿]/.test(text);
const uniqueTokens = (text: string) => [...new Set(tokenizeKnowledge(text).split(" "))].filter((t) => t.length >= 2);

export function detectBuLinksTopics(message: string): BuLinksTopic[] {
  const text = message.toLowerCase();
  return topicPatterns.filter(([, pattern]) => pattern.test(text)).map(([topic]) => topic);
}

export function rankServicePages(message: string, pages: BuLinksPage[], limit = 3): BuLinksPage[] {
  const thai = hasThai(message);
  const queryTokens = uniqueTokens(message).filter((t) => !stopWords.has(t));
  const docs = pages.map((page) => new Set(uniqueTokens(`${page.title} ${page.slug}`)));
  const idf = (token: string) => Math.log((pages.length + 1) / (docs.filter((d) => d.has(token)).length + 1)) + 1;
  const scored = pages
    .map((page, i) => ({ page, score: queryTokens.reduce((sum, t) => sum + (docs[i].has(t) ? idf(t) : 0), 0) }))
    .filter(({ page, score }) => score >= minScore && !(thai && new URL(page.url).pathname.startsWith("/en/")));
  const english = scored.filter(({ page }) => new URL(page.url).pathname.startsWith("/en/"));
  const pool = !thai && english.length ? english : scored;
  const best = Math.max(0, ...pool.map(({ score }) => score));
  const candidates = pool.filter(({ score }) => score >= best * relativeCut);

  // Same page published per year: keep the named year, else the newest.
  const named = message.match(/\b(20\d\d|25\d\d)\b/)?.[1];
  const namedYear = named ? (Number(named) > 2400 ? Number(named) - 543 : Number(named)) : undefined;
  const groups = new Map<string, typeof candidates>();
  for (const entry of candidates) {
    const key = `${entry.page.url.includes("/en/")}|${entry.page.slug.replace(/-(20\d\d)$/, "")}`;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  const yearOf = (page: BuLinksPage) => Number(page.slug.match(/-(20\d\d)$/)?.[1] ?? 0);
  return [...groups.values()]
    .map((group) => group.find(({ page }) => yearOf(page) === namedYear) ?? group.reduce((a, b) => (yearOf(b.page) > yearOf(a.page) ? b : a)))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ page }) => page);
}

export class BuLinksService {
  constructor(
    private readonly client: Pick<BuLinksClient, "listPages" | "latestPosts"> = buLinksClient,
    private readonly now: () => Date = () => new Date()
  ) {}

  async lookup(message: string): Promise<BuLinksLookup | null> {
    try {
      const topics = detectBuLinksTopics(message);
      const lang = hasThai(message) ? "th" : "en";
      if (!topics.length) {
        const pages = rankServicePages(message, await this.client.listPages());
        return pages.length ? { kind: "services", text: formatServiceLinks(pages), links: pages.map(({ title, url }) => ({ title, url })) } : null;
      }
      const extraLinks = (["calendar", "news"] as const).filter((t) => topics.includes(t))
        .map((t) => ({ title: fixedLinks[t][lang], url: officialKnowledgeUrlSchema.parse(fixedLinks[t].url) }));
      const ids = [...new Set(topics.flatMap((t) => (t in categories[lang] ? categories[lang][t as keyof typeof categories.th] : [])))];
      const posts = ids.length ? await this.client.latestPosts(ids, 5) : [];
      if (!posts.length && !extraLinks.length) return null;
      return {
        kind: "announcements",
        text: formatAnnouncements(posts, extraLinks, this.now()),
        links: [...posts.map(({ title, url }) => ({ title, url })), ...extraLinks]
      };
    } catch {
      return null;
    }
  }
}

export const buLinksService = new BuLinksService();
