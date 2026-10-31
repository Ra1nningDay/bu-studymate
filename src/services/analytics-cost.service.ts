import { analyticsCostRepository, type AnalyticsCostRepository } from "@/src/repositories/analytics-cost.repository";
import { calculateAiCost, calculateSearchCost, getModelPricing, USD_TO_THB_RATE } from "@/src/config/pricing.config";
import { analyticsDateRange, DAY_MS, BANGKOK_OFFSET_MS, type AnalyticsDateRange } from "@/lib/analytics-date-range";

const thaiDay = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" });

export class AnalyticsCostService {
  constructor(private repo: Pick<AnalyticsCostRepository, "getUsage"> = analyticsCostRepository) {}

  async getCostOverview(now = new Date(), range: AnalyticsDateRange = analyticsDateRange({}, now)) {
    if (range.error) throw new Error(range.error);
    const { buckets, detailedLogsAvailable } = await this.repo.getUsage(range.start, range.end);
    const models = new Map<string, { name: string; provider: string; tokens: number; unpricedTokens: number;
      missingUsageTokens: number; missingRateTokens: number; costUsd: number; pricedRecords: number }>();
    const daily = new Map<string, number>();
    let totalTokens = 0;
    let unpricedTokens = 0;
    let totalCostUsd = 0;
    let promptTokens = 0;
    let cachedTokens = 0;
    let pricedRecords = 0;
    let providerCostUsd = 0;
    let estimatedCostUsd = 0;
    let searchCostUsd = 0;
    let searchCalls = 0;
    let unknownSearchRequests = 0;

    for (const item of buckets) {
      // Old stored fallback amounts have no provenance; re-estimate complete splits only.
      const providerPriced = !item.legacy && item.costSource === "provider" && item.costUsd !== null;
      const tokenCost = !item.legacy && item.hasTokenBreakdown ? calculateAiCost(item.model, {
        totalTokens: item.tokens, promptTokens: item.promptTokens,
        completionTokens: item.completionTokens, cachedTokens: item.cachedTokens
      })?.costUsd ?? null : null;
      const searchCost = item.legacy ? 0 : calculateSearchCost(item.model, item.step, item.webSearchCalls);
      const priced = providerPriced || tokenCost !== null;
      const hasCost = priced || (searchCost !== null && (item.webSearchCalls ?? 0) > 0);
      const costUsd = providerPriced ? item.costUsd! : (tokenCost ?? 0) + (searchCost ?? 0);
      const key = JSON.stringify([item.provider, item.model]);
      const model = models.get(key) ?? { name: item.model, provider: item.provider, tokens: 0,
        unpricedTokens: 0, missingUsageTokens: 0, missingRateTokens: 0, costUsd: 0, pricedRecords: 0 };
      model.tokens += item.tokens;
      model.unpricedTokens += priced ? 0 : item.tokens;
      model.missingUsageTokens += !priced && !item.hasTokenBreakdown ? item.tokens : 0;
      model.missingRateTokens += !priced && item.hasTokenBreakdown ? item.tokens : 0;
      model.costUsd += costUsd;
      model.pricedRecords += hasCost ? 1 : 0;
      pricedRecords += hasCost ? 1 : 0;
      providerCostUsd += providerPriced ? costUsd : 0;
      estimatedCostUsd += providerPriced ? 0 : costUsd;
      searchCostUsd += providerPriced ? 0 : searchCost ?? 0;
      searchCalls += item.webSearchCalls ?? 0;
      unknownSearchRequests += searchCost === null && !providerPriced ? 1 : 0;
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
      totalCostUsd: pricedRecords > 0 ? totalCostUsd : null,
      totalCostThb: pricedRecords > 0 ? totalCostUsd * USD_TO_THB_RATE : null,
      cacheHitRatePercent: promptTokens > 0 ? Math.round(cachedTokens / promptTokens * 1000) / 10 : null,
      modelBreakdown: [...models.values()].sort((a, b) => b.tokens - a.tokens).map(model => ({
        ...model,
        pricing: getModelPricing(model.name),
        costThb: model.pricedRecords > 0 ? model.costUsd * USD_TO_THB_RATE : null,
        percent: totalTokens ? model.tokens / totalTokens * 100 : 0
      })),
      dailyStats: Array.from({ length: range.days }, (_, index) => {
        const day = new Date(range.start.getTime() + index * DAY_MS);
        const rawDate = new Date(day.getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
        return { date: thaiDay.format(day), rawDate, tokens: daily.get(rawDate) ?? 0 };
      }),
      detailedLogsAvailable,
      providerCostUsd, estimatedCostUsd, searchCostUsd, searchCalls, unknownSearchRequests,
      hasData: buckets.length > 0,
      generatedAt: now.toISOString()
    };
  }
}

export const analyticsCostService = new AnalyticsCostService();
