import { officialKnowledgeUrlSchema } from "@/src/dtos/knowledge.dto";

export const buLinksOrigin = "https://bulinks.bu.ac.th";
export type BuLinksPage = { id: number; title: string; url: string; slug: string };
export type BuLinksPost = { id: number; title: string; url: string; publishedAt: Date; categoryIds: number[] };

const maxTitleLength = 120;
const maxPageRequests = 5;
const pagesTtlMs = 60 * 60 * 1000;
const postsTtlMs = 20 * 1000;
const namedEntities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#039": "'" };

export function decodeWpText(html: string) {
  const text = html.replace(/<[^>]*>/g, " ")
    .replace(/&(?:#x([0-9a-f]+)|#(\d+)|(amp|lt|gt|quot|#039));/gi, (match, hex, dec, name) => {
      if (name) return namedEntities[name.toLowerCase()];
      const code = hex ? parseInt(hex, 16) : Number(dec);
      return code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }).replace(/\s+/g, " ").trim();
  return text.length > maxTitleLength ? `${text.slice(0, maxTitleLength - 1)}…` : text;
}

const officialUrl = (value: unknown) => {
  const parsed = officialKnowledgeUrlSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
};
const rendered = (value: unknown) => decodeWpText(String((value as { rendered?: unknown } | null)?.rendered ?? ""));

export class BuLinksClient {
  private pages?: { value: BuLinksPage[]; fetchedAt: number };
  private pagesInFlight?: Promise<BuLinksPage[]>;
  private posts = new Map<string, { value: BuLinksPost[]; fetchedAt: number }>();

  constructor(private readonly fetchImpl: typeof fetch = fetch, private readonly now: () => number = Date.now) {}

  private async get(path: string) {
    const response = await this.fetchImpl(`${buLinksOrigin}${path}`, {
      headers: { "User-Agent": "BU-StudyMate/1.0", Accept: "application/json" },
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) throw new Error(`BU Links request failed (${response.status})`);
    const body: unknown = await response.json();
    if (!Array.isArray(body)) throw new Error("BU Links returned an unexpected response");
    return { body: body as Record<string, unknown>[], totalPages: Number(response.headers.get("x-wp-totalpages")) || 1 };
  }

  private async fetchPages() {
    const pages: BuLinksPage[] = [];
    for (let n = 1, total = 1; n <= Math.min(total, maxPageRequests); n++) {
      const result = await this.get(`/wp-json/wp/v2/pages?per_page=100&page=${n}&_fields=id,link,slug,title`);
      total = result.totalPages;
      for (const item of result.body) {
        const url = officialUrl(item.link);
        const title = rendered(item.title);
        if (url && title && title.toLowerCase() !== "no access" && typeof item.id === "number") {
          pages.push({ id: item.id, title, url, slug: String(item.slug ?? "") });
        }
      }
    }
    return pages;
  }

  async listPages() {
    if (this.pages && this.now() - this.pages.fetchedAt < pagesTtlMs) return this.pages.value;
    this.pagesInFlight ??= this.fetchPages()
      .then((value) => { this.pages = { value, fetchedAt: this.now() }; return value; })
      // Stale-on-error: keep serving the last good list when a refresh fails.
      .catch((error) => { if (this.pages) return this.pages.value; throw error; })
      .finally(() => { this.pagesInFlight = undefined; });
    return this.pagesInFlight;
  }

  async latestPosts(categoryIds: number[], limit: number) {
    const categories = [...categoryIds].sort((a, b) => a - b).join(",");
    const key = `${categories}|${limit}`;
    const cached = this.posts.get(key);
    if (cached && this.now() - cached.fetchedAt < postsTtlMs) return cached.value;
    const { body } = await this.get(`/wp-json/wp/v2/posts?categories=${categories}&per_page=${limit}&orderby=date&order=desc&_fields=id,date_gmt,link,title,categories`);
    const value: BuLinksPost[] = [];
    for (const item of body) {
      const url = officialUrl(item.link);
      const publishedAt = new Date(`${String(item.date_gmt)}Z`);
      const title = rendered(item.title);
      if (url && title && typeof item.id === "number" && !Number.isNaN(publishedAt.getTime())) {
        const ids = Array.isArray(item.categories) ? item.categories.filter((id): id is number => typeof id === "number") : [];
        value.push({ id: item.id, title, url, publishedAt, categoryIds: ids });
      }
    }
    this.posts.set(key, { value, fetchedAt: this.now() });
    return value;
  }
}

export const buLinksClient = new BuLinksClient();
