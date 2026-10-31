// admin-perf-01 read-only measurement. Run:
//   pnpm exec tsx --env-file=.env.local .scratch/admin-perf/measure.ts
// Executes SELECT / EXPLAIN ANALYZE only. Prints timings and aggregates, no PII.
import { prisma } from "@/lib/prisma";
import { adminOverviewRepository } from "@/src/repositories/admin-overview.repository";
import { listBotRunReviews } from "@/lib/bot-run-review";

const DAY = 86_400_000;

async function time<T>(label: string, fn: () => Promise<T>, runs = 3) {
  const ms: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t = performance.now();
    await fn();
    ms.push(Math.round(performance.now() - t));
  }
  console.log(`${label.padEnd(44)} ${ms.join(" / ")} ms`);
  return ms;
}

async function explain(label: string, sql: string, params: unknown[]) {
  const rows = await prisma.$queryRawUnsafe<Array<{ "QUERY PLAN": string }>>(`EXPLAIN (ANALYZE, BUFFERS) ${sql}`, ...params);
  console.log(`\n--- EXPLAIN ${label}`);
  for (const row of rows) console.log(row["QUERY PLAN"]);
}

async function main() {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * DAY);
  const createdAt = { gte: start, lt: end };

  console.log("== round trip");
  await time("SELECT 1 (first includes connect)", () => prisma.$queryRaw`SELECT 1`, 5);

  console.log("\n== requireAdmin-equivalent query (users + roles)");
  await time("user.findFirst + roles", () => prisma.user.findFirst({
    where: { disabledAt: null },
    select: { id: true, email: true, roles: { select: { role: { select: { name: true } } } } }
  }), 5);

  console.log("\n== table sizes");
  const sizes = await prisma.$queryRaw<Array<{ relname: string; n: bigint }>>`
    SELECT relname::text AS relname, n_live_tup AS n FROM pg_stat_user_tables
    WHERE relname IN ('chat_messages','bot_runs','tickets','knowledge_items','study_materials','material_chunks','ai_token_logs')
    ORDER BY relname`;
  for (const s of sizes) console.log(`${s.relname.padEnd(20)} ~${s.n}`);

  console.log("\n== Overview (30 days)");
  await time("adminOverviewRepository.read (Promise.all x11)", () => adminOverviewRepository.read(start, end));
  console.log("-- individual (sequential)");
  await time("chat distinct users", () => prisma.$queryRaw`SELECT COUNT(DISTINCT line_user_id)::int FROM chat_messages WHERE role='user' AND created_at >= ${start} AND created_at < ${end}`);
  await time("chat daily distinct", () => prisma.$queryRaw`SELECT to_char(created_at AT TIME ZONE 'Asia/Bangkok','YYYY-MM-DD') AS day, COUNT(DISTINCT line_user_id)::int FROM chat_messages WHERE role='user' AND created_at >= ${start} AND created_at < ${end} GROUP BY day`);
  await time("botRun groupBy status", () => prisma.botRun.groupBy({ by: ["status"], where: { createdAt }, _count: { id: true } }));
  await time("botRun groupBy intent", () => prisma.botRun.groupBy({ by: ["intent"], where: { createdAt }, _count: { id: true } }));
  await time("botRun avg latency", () => prisma.botRun.aggregate({ where: { createdAt, status: "success" }, _avg: { latencyMs: true } }));
  await time("materialChunk.count", () => prisma.materialChunk.count());
  await time("knowledgeItem.count", () => prisma.knowledgeItem.count());

  console.log("\n== Bot Runs list (30 days, page 1, 12)");
  await time("listBotRunReviews", () => listBotRunReviews({ from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) }, 1, 12));

  await explain("chat distinct users", `SELECT COUNT(DISTINCT line_user_id)::int FROM chat_messages WHERE role='user' AND created_at >= $1 AND created_at < $2`, [start, end]);
  await explain("bot_runs group by status", `SELECT status, COUNT(id) FROM bot_runs WHERE created_at >= $1 AND created_at < $2 GROUP BY status`, [start, end]);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
