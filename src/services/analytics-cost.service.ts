import { analyticsCostRepository, type AnalyticsCostRepository } from "@/src/repositories/analytics-cost.repository";
import { MODEL_PRICING, USD_TO_THB_RATE } from "@/src/config/pricing.config";
import { analyticsDateRange, DAY_MS, BANGKOK_OFFSET_MS, type AnalyticsDateRange } from "@/lib/analytics-date-range";

const thaiDay = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" });

export class AnalyticsCostService {
  constructor(private repo: Pick<AnalyticsCostRepository, "getUsage"> = analyticsCostRepository) {}

  async getCostOverview(now = new Date(), range: AnalyticsDateRange = analyticsDateRange({}, now)) {
    if (range.error) throw new Error(range.error);
    const { buckets, detailedLogsAvailable } = await this.repo.getUsage(range.start, range.end);
    const models = new Map<string, { name: string; provider: string; tokens: number; unpricedTokens: number; costUsd: number }>();
    const daily = new Map<string, number>();
    let totalTokens = 0;
    let unpricedTokens = 0;
    let totalCostUsd = 0;
    let promptTokens = 0;
    let cachedTokens = 0;

    for (const item of buckets) {
      // Stored fallback rates and total-only legacy counts cannot establish a model's price.
      const knownModel = Object.keys(MODEL_PRICING).some(model => item.model.toLowerCase().includes(model));
      const priced = !item.legacy && item.hasTokenBreakdown && knownModel && item.costUsd !== null;
      const costUsd = priced ? item.costUsd! : 0;
      const key = JSON.stringify([item.provider, item.model]);
      const model = models.get(key) ?? { name: item.model, provider: item.provider, tokens: 0, unpricedTokens: 0, costUsd: 0 };
      model.tokens += item.tokens;
      model.unpricedTokens += priced ? 0 : item.tokens;
      model.costUsd += costUsd;
      models.set(key, model);
      daily.set(item.day, (daily.get(item.day) ?? 0) + item.tokens);
      totalTokens += item.tokens;
      unpricedTokens += priced ? 0 : item.tokens;
      totalCostUsd += costUsd;
      promptTokens += item.promptTokens;
      cachedTokens += item.cachedTokens;
    }

    return {
      totalTokens, unpricedTokens,
      totalCostUsd: totalTokens > unpricedTokens ? totalCostUsd : null,
      totalCostThb: totalTokens > unpricedTokens ? totalCostUsd * USD_TO_THB_RATE : null,
      cacheHitRatePercent: promptTokens > 0 ? Math.round(cachedTokens / promptTokens * 1000) / 10 : null,
      modelBreakdown: [...models.values()].sort((a, b) => b.tokens - a.tokens).map(model => ({
        ...model,
        costThb: model.tokens > model.unpricedTokens ? model.costUsd * USD_TO_THB_RATE : null,
        percent: totalTokens ? model.tokens / totalTokens * 100 : 0
      })),
      dailyStats: Array.from({ length: range.days }, (_, index) => {
        const day = new Date(range.start.getTime() + index * DAY_MS);
        const rawDate = new Date(day.getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
        return { date: thaiDay.format(day), rawDate, tokens: daily.get(rawDate) ?? 0 };
      }),
      detailedLogsAvailable,
      hasData: buckets.length > 0,
      generatedAt: now.toISOString()
    };
  }
}

export const analyticsCostService = new AnalyticsCostService();
