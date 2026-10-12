import { adminOverviewRepository, type AdminOverviewRepository } from "@/src/repositories/admin-overview.repository";

const dayMs = 24 * 60 * 60 * 1000;
const bangkokOffset = 7 * 60 * 60 * 1000;

export function overviewWindow(now: Date) {
  const local = new Date(now.getTime() + bangkokOffset);
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - bangkokOffset;
  return { start: new Date(midnight - 6 * dayMs), end: now };
}

export class AdminOverviewService {
  constructor(private repository: AdminOverviewRepository = adminOverviewRepository) {}

  async read(now = new Date()) {
    const { start, end } = overviewWindow(now);
    const data = await this.repository.read(start, end);
    const totalRuns = data.statuses.reduce((sum, item) => sum + item._count.id, 0);
    const successfulRuns = data.statuses.find((item) => item.status === "success")?._count.id ?? 0;
    const errorRuns = data.statuses.find((item) => item.status === "error")?._count.id ?? 0;
    const counts = new Map(data.daily.map((item) => [item.day, item.count]));
    const days = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(start.getTime() + index * dayMs + bangkokOffset).toISOString().slice(0, 10);
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
