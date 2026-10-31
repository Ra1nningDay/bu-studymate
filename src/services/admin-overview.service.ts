import { revalidateTag, unstable_cache } from "next/cache";
import { adminOverviewRepository, type AdminOverviewRepository, type OverviewCorpusCounts } from "@/src/repositories/admin-overview.repository";
import { analyticsDateRange, DAY_MS, BANGKOK_OFFSET_MS, type AnalyticsDateRange } from "@/lib/analytics-date-range";

export const OVERVIEW_CORPUS_COUNTS_TAG = "admin-overview-counts";

export function invalidateOverviewCorpusCounts() {
  try {
    revalidateTag(OVERVIEW_CORPUS_COUNTS_TAG);
  } catch {
    // Called outside a Next.js request context (e.g. CLI scripts or unit tests); safe to ignore.
  }
}

const getCachedCorpusCounts = unstable_cache(
  () => adminOverviewRepository.readCorpusCounts(),
  ["admin-overview-corpus-counts"],
  { revalidate: 60, tags: [OVERVIEW_CORPUS_COUNTS_TAG] }
);

type OverviewRepoInput = {
  read: AdminOverviewRepository["read"];
  readRangeMetrics?: AdminOverviewRepository["readRangeMetrics"];
  readCorpusCounts?: AdminOverviewRepository["readCorpusCounts"];
};

export class AdminOverviewService {
  constructor(
    private repository: OverviewRepoInput = adminOverviewRepository,
    private readCachedCorpus: () => Promise<OverviewCorpusCounts> = async () => {
      try {
        return await getCachedCorpusCounts();
      } catch {
        return (this.repository.readCorpusCounts ?? (() => adminOverviewRepository.readCorpusCounts()))();
      }
    }
  ) {}

  async readCorpusSnapshot(): Promise<OverviewCorpusCounts> {
    if (this.repository !== adminOverviewRepository && this.repository.readCorpusCounts) {
      return this.repository.readCorpusCounts();
    }
    return this.readCachedCorpus();
  }

  async read(now = new Date(), range: AnalyticsDateRange = analyticsDateRange({}, now)) {
    if (range.error) throw new Error(range.error);
    const { start, end } = range;
    const data = this.repository === adminOverviewRepository && this.repository.readRangeMetrics
      ? await Promise.all([this.repository.readRangeMetrics(start, end), this.readCorpusSnapshot()]).then(([r, c]) => ({ ...r, ...c }))
      : await this.repository.read(start, end);
    const totalRuns = data.statuses.reduce((sum, item) => sum + item._count.id, 0);
    const successfulRuns = data.statuses.find((item) => item.status === "success")?._count.id ?? 0;
    const errorRuns = data.statuses.find((item) => item.status === "error")?._count.id ?? 0;
    const counts = new Map(data.daily.map((item) => [item.day, item.count]));
    const days = Array.from({ length: range.days }, (_, index) => {
      const day = new Date(start.getTime() + index * DAY_MS + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
      return { day, count: counts.get(day) ?? 0 };
    });
    const intents = data.intents.map((item) => ({ name: item.intent ?? "ยังไม่ระบุ", count: item._count.id }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    const topIntents = intents.slice(0, 5);
    const remaining = intents.slice(5).reduce((sum, item) => sum + item.count, 0);
    if (remaining) topIntents.push({ name: "อื่น ๆ", count: remaining });
    return {
      ...data, days, topIntents, totalRuns, successfulRuns, errorRuns,
      successRate: totalRuns ? successfulRuns / totalRuns * 100 : null,
      averageLatencyMs: data.latency._avg.latencyMs,
      totalConversations: data.conversations[0]?.count ?? 0,
      generatedAt: now.toISOString()
    };
  }
}

export const adminOverviewService = new AdminOverviewService();
export type AdminOverview = Awaited<ReturnType<AdminOverviewService["read"]>>;
