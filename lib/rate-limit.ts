import { prisma } from "@/lib/prisma";

type RateLimitWindow = {
  limit: number;
  seconds: number;
};

type ConsumeRateLimitInput = {
  lineUserId: string;
  scope: string;
  windows: RateLimitWindow[];
};

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds?: number;
};

export const messageRateLimit = {
  scope: "message",
  windows: [
    { limit: 30, seconds: 60 * 60 },
    { limit: 100, seconds: 5 * 60 * 60 }
  ]
} satisfies Pick<ConsumeRateLimitInput, "scope" | "windows">;

export const fileUploadRateLimit = {
  scope: "file_upload",
  windows: [
    { limit: 3, seconds: 60 * 60 },
    { limit: 8, seconds: 5 * 60 * 60 }
  ]
} satisfies Pick<ConsumeRateLimitInput, "scope" | "windows">;

function secondsAgo(now: Date, seconds: number) {
  return new Date(now.getTime() - seconds * 1000);
}

async function getRetryAfterSeconds({
  lineUserId,
  now,
  overLimitBy,
  scope,
  window
}: {
  lineUserId: string;
  now: Date;
  overLimitBy: number;
  scope: string;
  window: RateLimitWindow;
}) {
  const expiringEvents = await prisma.rateLimitEvent.findMany({
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
    take: overLimitBy,
    where: {
      lineUserId,
      scope,
      createdAt: {
        gte: secondsAgo(now, window.seconds)
      }
    }
  });
  const lastEventToExpire = expiringEvents.at(-1);

  if (!lastEventToExpire) {
    return window.seconds;
  }

  const retryAt = lastEventToExpire.createdAt.getTime() + window.seconds * 1000;
  return Math.max(1, Math.ceil((retryAt - now.getTime()) / 1000));
}

export async function consumeRateLimit({
  lineUserId,
  scope,
  windows
}: ConsumeRateLimitInput): Promise<RateLimitResult> {
  const now = new Date();
  const maxWindowSeconds = Math.max(...windows.map((window) => window.seconds));

  const counts = await prisma.$transaction(async (tx) => {
    await tx.rateLimitEvent.deleteMany({
      where: {
        lineUserId,
        scope,
        createdAt: {
          lt: secondsAgo(now, maxWindowSeconds)
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
      windows.map((window) =>
        tx.rateLimitEvent.count({
          where: {
            lineUserId,
            scope,
            createdAt: {
              gte: secondsAgo(now, window.seconds)
            }
          }
        })
      )
    );
  });

  const exceeded = windows
    .map((window, index) => ({
      count: counts[index],
      window
    }))
    .filter(({ count, window }) => count > window.limit);

  if (exceeded.length === 0) {
    return { allowed: true };
  }

  const retryAfterSeconds = Math.max(
    ...(await Promise.all(
      exceeded.map(({ count, window }) =>
        getRetryAfterSeconds({
          lineUserId,
          now,
          overLimitBy: count - window.limit,
          scope,
          window
        })
      )
    ))
  );

  return {
    allowed: false,
    retryAfterSeconds
  };
}

export function formatRateLimitMessage(result: RateLimitResult) {
  const retryAfterSeconds = result.retryAfterSeconds ?? 60;
  const retryAfterMinutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));

  if (retryAfterMinutes >= 60) {
    const retryAfterHours = Math.ceil(retryAfterMinutes / 60);
    return `ใช้งานครบโควตาชั่วคราวครับ ลองใหม่ในอีกประมาณ ${retryAfterHours} ชั่วโมง`;
  }

  return `ใช้งานครบโควตาชั่วคราวครับ ลองใหม่ในอีกประมาณ ${retryAfterMinutes} นาที`;
}
