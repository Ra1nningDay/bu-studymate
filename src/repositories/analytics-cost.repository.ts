import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface UsageBucket {
  day: string;
  model: string;
  provider: string;
  tokens: number;
  promptTokens: number;
  cachedTokens: number;
  costUsd: number | null;
  hasTokenBreakdown: boolean;
  legacy: boolean;
}

export class AnalyticsCostRepository {
  constructor(private db: Pick<PrismaClient, "$queryRaw"> = prisma) {}

  async getUsage(start: Date, end: Date) {
    const [table] = await this.db.$queryRaw<Array<{ available: boolean }>>`
      SELECT to_regclass('public.ai_token_logs') IS NOT NULL AS available
    `;
    const detailedLogsAvailable = table?.available ?? false;
    // Old databases can still report BotRun totals before the additive log migration.
    const logs = detailedLogsAvailable ? Prisma.sql`
      SELECT l.*, COALESCE(r.created_at, l.created_at) AS usage_at
      FROM ai_token_logs l LEFT JOIN bot_runs r ON r.id = l.bot_run_id
      WHERE COALESCE(r.created_at, l.created_at) >= ${start}
        AND COALESCE(r.created_at, l.created_at) < ${end}
    ` : Prisma.sql`
      SELECT NULL::uuid AS bot_run_id, NULL::text AS model, NULL::text AS provider,
        0::int AS total_tokens, 0::int AS prompt_tokens, 0::int AS completion_tokens,
        0::int AS cached_tokens, NULL::numeric AS cost_usd, NULL::timestamptz AS usage_at
      WHERE FALSE
    `;
    const rows = await this.db.$queryRaw<Array<{
      day: string; model: string; provider: string; tokens: bigint;
      prompt_tokens: bigint; cached_tokens: bigint; cost_usd: Prisma.Decimal | null;
      has_token_breakdown: boolean; legacy: boolean;
    }>>(Prisma.sql`
      WITH logs AS (${logs}), logged_totals AS (
        SELECT bot_run_id, SUM(total_tokens) AS tokens FROM logs GROUP BY bot_run_id
      ), usage AS (
        SELECT usage_at, model, provider, total_tokens::numeric AS tokens,
          prompt_tokens, cached_tokens, cost_usd,
          (prompt_tokens + completion_tokens > 0) AS has_token_breakdown, FALSE AS legacy
        FROM logs WHERE usage_at >= ${start} AND usage_at < ${end}
        UNION ALL
        SELECT r.created_at, 'Legacy (รวมหลายขั้นตอน)', 'BotRun',
          GREATEST((CASE WHEN jsonb_typeof(r.metadata->'tokensUsed') = 'number'
            THEN (r.metadata->>'tokensUsed')::numeric ELSE 0 END)
            - COALESCE(t.tokens, 0), 0),
          0, 0, NULL::numeric, FALSE, TRUE
        FROM bot_runs r LEFT JOIN logged_totals t ON t.bot_run_id = r.id
        WHERE r.created_at >= ${start} AND r.created_at < ${end}
      )
      SELECT to_char(usage_at AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD') AS day,
        model, provider, SUM(tokens)::bigint AS tokens,
        SUM(prompt_tokens)::bigint AS prompt_tokens, SUM(cached_tokens)::bigint AS cached_tokens,
        SUM(cost_usd) AS cost_usd, has_token_breakdown, legacy
      FROM usage WHERE tokens > 0
      GROUP BY day, model, provider, has_token_breakdown, legacy ORDER BY day, model
    `);
    return {
      detailedLogsAvailable,
      buckets: rows.map((row): UsageBucket => ({
        day: row.day, model: row.model, provider: row.provider,
        tokens: Number(row.tokens), promptTokens: Number(row.prompt_tokens),
        cachedTokens: Number(row.cached_tokens),
        costUsd: row.cost_usd === null ? null : Number(row.cost_usd),
        hasTokenBreakdown: row.has_token_breakdown, legacy: row.legacy
      }))
    };
  }
}

export const analyticsCostRepository = new AnalyticsCostRepository();
