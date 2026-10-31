import { loadEnvConfig } from "@next/env";
import { writeFile, mkdir } from "node:fs/promises";

loadEnvConfig(process.cwd());

async function main() {
  const { prisma } = await import("../../src/lib/prisma");
  const { env } = await import("../../src/config/env");
  const { knowledgeRepository } = await import("../../src/repositories/knowledge.repository");
  try {
    const admin = await prisma.user.findUnique({ where: { email: "tkhamkawe@gmail.com" },
      select: { id: true, disabledAt: true, roles: { select: { role: { select: { name: true } } } } } });
    const documents = await prisma.knowledgeItem.findMany({ orderBy: { title: "asc" },
      select: { id: true, title: true, content: true, category: true, keywords: true, sourceUrl: true,
        sourceKind: true, verifiedAt: true, reviewAfter: true, validUntil: true, sourceStatus: true } });
    const digest = await prisma.$queryRaw`SELECT
      (SELECT md5(coalesce(string_agg(to_jsonb(k)::text, '' ORDER BY id), '')) FROM knowledge_items k) AS knowledge,
      (SELECT md5(coalesce(string_agg(to_jsonb(c)::text, '' ORDER BY id), '')) FROM knowledge_chunks c) AS chunks,
      (SELECT md5(coalesce(string_agg(to_jsonb(m)::text, '' ORDER BY id), '')) FROM chat_messages m) AS messages,
      (SELECT md5(coalesce(string_agg(to_jsonb(r)::text, '' ORDER BY id), '')) FROM bot_runs r) AS runs`;
    const ready = await knowledgeRepository.hasIndexedEvidence();
    const tables = await prisma.$queryRaw`SELECT to_regclass('public.ai_token_logs') IS NOT NULL AS token_logs`;
    const snapshot = { capturedAt: new Date().toISOString(), admin, ready, tables, digest, documents,
      config: { model: env.OPENAI_MODEL, routerMode: env.AGENT_ROUTER_MODE, routerModel: env.OPENAI_AGENT_ROUTER_MODEL,
        jevModel: env.JEV_ROUTER_MODEL, rerankModel: env.OPENAI_RERANK_MODEL, rewriteModel: env.OPENAI_QUERY_REWRITE_MODEL,
        webModel: env.OPENAI_WEB_SEARCH_MODEL, openaiConfigured: Boolean(env.OPENAI_API_KEY),
        openrouterConfigured: Boolean(env.OPENROUTER_API_KEY), adminConfigured: Boolean(env.ADMIN_SESSION_SECRET) } };
    await mkdir("output/chat-benchmark", { recursive: true });
    await writeFile("output/chat-benchmark/baseline.json", JSON.stringify(snapshot, null, 2));
    console.log(JSON.stringify({ ...snapshot, documents: documents.map(({ id, title, category, reviewAfter, sourceStatus }) => ({ id, title, category, reviewAfter, sourceStatus })) }, null, 2));
  } finally { await prisma.$disconnect(); }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
