import test from "node:test";
import assert from "node:assert/strict";
import { AnalyticsCostService } from "./analytics-cost.service";
import type { UsageBucket } from "@/src/repositories/analytics-cost.repository";
import { analyticsDateRange } from "@/lib/analytics-date-range";

const now = new Date("2026-10-30T12:00:00Z");
const bucket: UsageBucket = { day: "2026-10-30", model: "gpt-4o-mini", provider: "OpenAI", tokens: 100000, promptTokens: 80000, completionTokens: 20000, cachedTokens: 20000, costUsd: 1.5, step: "answer", costSource: "provider", webSearchCalls: null, hasTokenBreakdown: true, legacy: false };

function service(buckets: UsageBucket[], available = true) {
  return new AnalyticsCostService({ getUsage: async () => ({ buckets, detailedLogsAvailable: available, costTrackingAvailable: available }) });
}

test("cost uses saved amounts, actual cached tokens and fills only selected Bangkok days", async () => {
  let queried: Date[] = [];
  const result = await new AnalyticsCostService({ getUsage: async (start, end) => {
    queried = [start, end];
    return { buckets: [bucket], detailedLogsAvailable: true, costTrackingAvailable: true };
  } }).getCostOverview(now, analyticsDateRange({ from: "2026-10-29", to: "2026-10-30" }, now));
  assert.deepEqual(queried.map(date => date.toISOString()), ["2026-10-28T17:00:00.000Z", "2026-10-30T17:00:00.000Z"]);
  assert.equal(result.totalTokens, 100000);
  assert.equal(result.totalCostThb, 52.5);
  assert.equal(result.cacheHitRatePercent, 25);
  assert.deepEqual(result.dailyStats.map(day => day.tokens), [0, 100000]);
  assert.equal(result.modelBreakdown[0].percent, 100);
});

test("legacy tokens are included but do not acquire an invented price or cache rate", async () => {
  const result = await service([{ ...bucket, model: "Legacy", legacy: true, hasTokenBreakdown: false, promptTokens: 0, cachedTokens: 0, costUsd: null }], false).getCostOverview(now);
  assert.equal(result.totalTokens, 100000);
  assert.equal(result.unpricedTokens, 100000);
  assert.equal(result.totalCostUsd, null);
  assert.equal(result.cacheHitRatePercent, null);
  assert.equal(result.detailedLogsAvailable, false);
});

test("unsupported model fallback prices and total-only logs are excluded from money totals", async () => {
  const result = await service([bucket, { ...bucket, model: "unknown-model", tokens: 1000, costSource: null }, { ...bucket, model: "gpt-4o-mini", tokens: 500, hasTokenBreakdown: false, costSource: null }]).getCostOverview(now);
  assert.equal(result.totalTokens, 101500);
  assert.equal(result.unpricedTokens, 1500);
  assert.equal(result.totalCostUsd, 1.5);
  assert.equal(result.modelBreakdown.find(model => model.name === "gpt-4o-mini")?.unpricedTokens, 500);
});

test("empty data stays empty and a recorded zero price stays zero", async () => {
  const empty = await service([]).getCostOverview(now);
  assert.equal(empty.totalTokens, 0);
  assert.equal(empty.totalCostUsd, null);
  assert.equal(empty.hasData, false);
  assert.equal(empty.modelBreakdown.length, 0);
  assert.equal(empty.dailyStats.length, 7);
  const free = await service([{ ...bucket, costUsd: 0 }]).getCostOverview(now);
  assert.equal(free.totalCostUsd, 0);
  assert.equal(free.totalCostThb, 0);
});

test("model grouping keeps providers separate and sums repeated days", async () => {
  const result = await service([bucket, { ...bucket, day: "2026-10-29" }, { ...bucket, provider: "OpenRouter" }]).getCostOverview(now);
  assert.equal(result.modelBreakdown.length, 2);
  assert.equal(result.totalTokens, 300000);
  assert.equal(result.dailyStats.at(-1)?.tokens, 200000);
});

test("invalid ranges stop before repository calls and storage failures propagate", async () => {
  const broken = new AnalyticsCostService({ getUsage: async () => { throw new Error("storage unavailable"); } });
  await assert.rejects(broken.getCostOverview(now), /storage unavailable/);
  await assert.rejects(broken.getCostOverview(now, analyticsDateRange({ from: "bad" }, now)), /YYYY-MM-DD/);
});

test("old Luna fallback money is ignored; complete splits are re-estimated and incomplete logs stay unpriced", async () => {
  const luna = { ...bucket, model: "gpt-6-luna", costSource: null, costUsd: 999 };
  const result = await service([luna, { ...luna, hasTokenBreakdown: false, promptTokens: 0, completionTokens: 0, cachedTokens: 0 }]).getCostOverview(now);
  assert.ok(Math.abs(result.totalCostUsd! - 0.0162) < 1e-12);
  assert.equal(result.unpricedTokens, 100000);
  assert.equal(result.modelBreakdown[0].missingUsageTokens, 100000);
  assert.equal(result.modelBreakdown[0].missingRateTokens, 0);
  assert.equal(result.modelBreakdown[0].pricing?.promptCostPerMillion, 0.1);
});

test("provider amounts survive missing model rates/splits and already include tool fees", async () => {
  const result = await service([{ ...bucket, model: "unlisted", hasTokenBreakdown: false,
    costUsd: 0.1234, step: "web_search", webSearchCalls: 2 }]).getCostOverview(now);
  assert.equal(result.totalCostUsd, 0.1234);
  assert.equal(result.providerCostUsd, 0.1234);
  assert.equal(result.estimatedCostUsd, 0);
  assert.equal(result.searchCostUsd, 0);
  assert.equal(result.unpricedTokens, 0);
});

test("search fees are included once, observed zero-token calls count, and unknown counts stay explicit", async () => {
  const luna = { ...bucket, model: "gpt-6-luna", costSource: null, step: "web_search_preview" };
  const result = await service([
    { ...luna, webSearchCalls: 2 },
    { ...luna, tokens: 0, promptTokens: 0, completionTokens: 0, cachedTokens: 0, hasTokenBreakdown: false, webSearchCalls: 1 },
    { ...luna, webSearchCalls: null }
  ]).getCostOverview(now);
  assert.ok(Math.abs(result.totalCostUsd! - (0.0162 * 2 + 0.03)) < 1e-12);
  assert.equal(result.searchCalls, 3);
  assert.equal(result.searchCostUsd, 0.03);
  assert.equal(result.unknownSearchRequests, 1);
  assert.equal(result.totalTokens, 200000);
});
