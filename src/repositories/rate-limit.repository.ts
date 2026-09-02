import { prisma } from "@/lib/prisma";

export class RateLimitRepository {
  async recordEventAndGetCounts({
    lineUserId,
    scope,
    oldestWindowDate,
    windowDates
  }: {
    lineUserId: string;
    scope: string;
    oldestWindowDate: Date;
    windowDates: Date[];
  }) {
    return prisma.$transaction(async (tx) => {
      await tx.rateLimitEvent.deleteMany({
        where: {
          lineUserId,
          scope,
          createdAt: {
            lt: oldestWindowDate
          }
        }
      });

      await tx.rateLimitEvent.create({
        data: {
          lineUserId,
          scope
        }
      });

      return Promise.all(
        windowDates.map((sinceDate) =>
          tx.rateLimitEvent.count({
            where: {
              lineUserId,
              scope,
              createdAt: {
                gte: sinceDate
              }
            }
          })
        )
      );
    });
  }

  async getExpiringEvents({
    lineUserId,
    scope,
    sinceDate,
    take
  }: {
    lineUserId: string;
    scope: string;
    sinceDate: Date;
    take: number;
  }) {
    return prisma.rateLimitEvent.findMany({
      where: {
        lineUserId,
        scope,
        createdAt: {
          gte: sinceDate
        }
      },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
      take
    });
  }
}

export const rateLimitRepository = new RateLimitRepository();
