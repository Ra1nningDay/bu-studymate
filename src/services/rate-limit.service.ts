import {
  rateLimitRepository,
  type RateLimitRepository
} from "@/src/repositories/rate-limit.repository";

export type RateLimitWindow = {
  limit: number;
  seconds: number;
};

export type ConsumeRateLimitInput = {
  lineUserId: string;
  scope: string;
  windows: RateLimitWindow[];
};

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds?: number;
};

export const messageRateLimitConfig = {
  scope: "message",
  windows: [
    { limit: 30, seconds: 60 * 60 },
    { limit: 100, seconds: 5 * 60 * 60 }
  ]
};

export const fileUploadRateLimitConfig = {
  scope: "file_upload",
  windows: [
    { limit: 3, seconds: 60 * 60 },
    { limit: 8, seconds: 5 * 60 * 60 }
  ]
};

export const adminLoginRateLimitConfig = {
  scope: "admin_login",
  windows: [
    { limit: 10, seconds: 15 * 60 },
    { limit: 30, seconds: 60 * 60 }
  ]
};

function secondsAgo(now: Date, seconds: number) {
  return new Date(now.getTime() - seconds * 1000);
}

export class RateLimitService {
  constructor(private repo: RateLimitRepository = rateLimitRepository) {}

  async consume({ lineUserId, scope, windows }: ConsumeRateLimitInput): Promise<RateLimitResult> {
    const now = new Date();
    const maxWindowSeconds = Math.max(...windows.map((w) => w.seconds));
    const oldestWindowDate = secondsAgo(now, maxWindowSeconds);
    const windowDates = windows.map((w) => secondsAgo(now, w.seconds));

    const counts = await this.repo.recordEventAndGetCounts({
      lineUserId,
      scope,
      oldestWindowDate,
      windowDates
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
        exceeded.map(async ({ count, window }) => {
          const expiringEvents = await this.repo.getExpiringEvents({
            lineUserId,
            scope,
            sinceDate: secondsAgo(now, window.seconds),
            take: count - window.limit
          });
          const lastEventToExpire = expiringEvents.at(-1);
          if (!lastEventToExpire) {
            return window.seconds;
          }
          const retryAt = lastEventToExpire.createdAt.getTime() + window.seconds * 1000;
          return Math.max(1, Math.ceil((retryAt - now.getTime()) / 1000));
        })
      ))
    );

    return {
      allowed: false,
      retryAfterSeconds
    };
  }

  formatMessage(result: RateLimitResult) {
    const retryAfterSeconds = result.retryAfterSeconds ?? 60;
    const retryAfterMinutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));

    if (retryAfterMinutes >= 60) {
      const retryAfterHours = Math.ceil(retryAfterMinutes / 60);
      return `ใช้งานครบโควตาชั่วคราวครับ ลองใหม่ในอีกประมาณ ${retryAfterHours} ชั่วโมง`;
    }

    return `ใช้งานครบโควตาชั่วคราวครับ ลองใหม่ในอีกประมาณ ${retryAfterMinutes} นาที`;
  }
}

export const rateLimitService = new RateLimitService();

export function formatRateLimitMessage(result: RateLimitResult): string {
  return rateLimitService.formatMessage(result);
}
