import { loadEnvConfig } from "@next/env";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";

async function main() {
  loadEnvConfig(process.cwd());
  const { prisma } = await import("../../src/lib/prisma");
  const { AnalyticsCostRepository } = await import("../../src/repositories/analytics-cost.repository");
  // CTEs shadow physical tables: all fixture data lives in this SELECT statement.
  const fixtureFor = (migrated: boolean) => `WITH bot_runs AS (
    SELECT ('00000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid AS id,
      CASE WHEN i=6 THEN '2026-10-31T17:00:00Z'::timestamptz WHEN i=7 THEN '2026-10-30T16:59:59Z'::timestamptz ELSE '2026-10-31T03:00:00Z'::timestamptz END AS created_at,
      CASE WHEN i=1 OR i=2 THEN '{"tokensUsed":100}'::jsonb WHEN i=3 THEN '{"tokensUsed":50}'::jsonb WHEN i=5 THEN '{"tokensUsed":20}'::jsonb ELSE '{"tokensUsed":"invalid"}'::jsonb END AS metadata
    FROM generate_series(1,7) i
  ), ai_token_logs AS (
    SELECT CASE WHEN i=8 THEN NULL ELSE ('00000000-0000-4000-8000-' || lpad((CASE WHEN i=9 THEN 1 ELSE i END)::text,12,'0'))::uuid END AS bot_run_id,
      CASE WHEN i=10 THEN 'gpt-6-luna' ELSE 'gpt-4o-mini' END AS model, 'openai'::text AS provider,
      CASE WHEN i=10 THEN 'web_search_preview' ELSE 'answer' END AS step,
      ${migrated ? "CASE WHEN i=8 THEN 'provider' ELSE NULL END::text AS cost_source, CASE WHEN i=10 THEN 2 ELSE NULL END::int AS web_search_calls," : ''}
      CASE WHEN i=1 OR i=2 THEN 40 WHEN i=9 THEN 60 WHEN i=5 THEN 30 WHEN i=8 THEN 7 WHEN i=10 THEN 0 ELSE 10 END AS total_tokens,
      CASE WHEN i=10 THEN 0 ELSE 5 END AS prompt_tokens, CASE WHEN i=10 THEN 0 ELSE 2 END AS completion_tokens, 0 AS cached_tokens, 0.01::numeric AS cost_usd,
      CASE WHEN i=9 THEN '2026-11-02T03:00:00Z'::timestamptz ELSE '2026-10-31T03:00:00Z'::timestamptz END AS created_at
    FROM (VALUES (1),(2),(5),(6),(7),(8),(9),(10)) v(i)
  ), `;
  try {
    const { AnalyticsCostService } = await import("../../src/services/analytics-cost.service");
    const { analyticsDateRange } = await import("../../src/lib/analytics-date-range");
    for (const [available, migrated] of [[false, false], [true, false], [true, true]]) {
      const fixture = fixtureFor(migrated);
      const db = { $queryRaw: async (query: Prisma.Sql | TemplateStringsArray) => {
        if (Array.isArray(query)) return [{ available, cost_tracking_available: migrated }];
        const sql = query as Prisma.Sql;
        return prisma.$queryRawUnsafe(sql.text.replace(/^\s*WITH\s+/, fixture), ...sql.values);
      } };
      const result = await new AnalyticsCostRepository(db as never).getUsage(new Date("2026-10-30T17:00:00Z"), new Date("2026-10-31T17:00:00Z"));
      assert.equal(result.buckets.reduce((sum,bucket)=>sum+bucket.tokens,0),available?287:270);
      assert.equal(result.buckets.filter(bucket=>bucket.legacy).reduce((sum,bucket)=>sum+bucket.tokens,0),available?110:270);
      assert.ok(result.buckets.every(bucket=>bucket.day==='2026-10-31'));
      const overview = await new AnalyticsCostService(new AnalyticsCostRepository(db as never)).getCostOverview(new Date("2026-10-31T12:00:00Z"), analyticsDateRange({ from: "2026-10-31", to: "2026-10-31" }));
      assert.equal(overview.searchCalls, migrated ? 2 : 0);
      if (migrated) {
        assert.ok(Math.abs(overview.totalCostUsd! - 0.03) < 1e-12);
        assert.equal(overview.providerCostUsd, 0.01);
        assert.equal(overview.searchCostUsd, 0.02);
      } else if (available) {
        assert.ok(Math.abs(overview.totalCostUsd! - 0.00000195) < 1e-12);
      }
      console.log(`PASS SQL: detailed logs ${available}, migrated ${migrated}, legacy residual, complete/partial overlap, exclusive boundary, invalid metadata and unlinked usage`);
    }
  } finally { await prisma.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
