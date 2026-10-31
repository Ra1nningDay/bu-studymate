import { prisma } from "@/lib/prisma";

export interface OverviewCorpusCounts {
  knowledgeItems: number;
  studyMaterials: number;
  chunks: number;
}

export class AdminOverviewRepository {
  async readCorpusCounts(): Promise<OverviewCorpusCounts> {
    const [knowledgeItems, studyMaterials, chunks] = await Promise.all([
      prisma.knowledgeItem.count(),
      prisma.studyMaterial.count(),
      prisma.materialChunk.count()
    ]);
    return { knowledgeItems, studyMaterials, chunks };
  }

  async readRangeMetrics(start: Date, end: Date) {
    const createdAt = { gte: start, lt: end };
    const [conversations, daily, statuses, intents, latency, openTickets, tickets, failures] = await Promise.all([
      prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(DISTINCT line_user_id)::int AS count FROM chat_messages
        WHERE role = 'user' AND created_at >= ${start} AND created_at < ${end}`,
      prisma.$queryRaw<Array<{ day: string; count: number }>>`
        SELECT to_char(created_at AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD') AS day,
          COUNT(DISTINCT line_user_id)::int AS count FROM chat_messages
        WHERE role = 'user' AND created_at >= ${start} AND created_at < ${end}
        GROUP BY day ORDER BY day`,
      prisma.botRun.groupBy({ by: ["status"], where: { createdAt }, _count: { id: true } }),
      prisma.botRun.groupBy({ by: ["intent"], where: { createdAt }, _count: { id: true } }),
      prisma.botRun.aggregate({ where: { createdAt, status: "success" }, _avg: { latencyMs: true } }),
      prisma.ticket.count({ where: { status: { in: ["PENDING", "IN_PROGRESS"] } } }),
      prisma.ticket.findMany({
        where: { status: { in: ["PENDING", "IN_PROGRESS"] } },
        orderBy: { updatedAt: "desc" }, take: 5,
        select: { id: true, ticketCode: true, description: true, status: true, updatedAt: true }
      }),
      prisma.botRun.findMany({
        where: { createdAt, status: "error" }, orderBy: { createdAt: "desc" }, take: 5,
        select: { id: true, intent: true, errorCode: true, createdAt: true }
      })
    ]);
    return { conversations, daily, statuses, intents, latency, openTickets, tickets, failures };
  }

  async read(start: Date, end: Date) {
    const [range, corpus] = await Promise.all([
      this.readRangeMetrics(start, end),
      this.readCorpusCounts()
    ]);
    return { ...range, ...corpus };
  }
}

export const adminOverviewRepository = new AdminOverviewRepository();
