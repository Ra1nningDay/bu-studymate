/**
 * Facade for backward compatibility.
 * Core rate limiting logic has been refactored to src/services/rate-limit.service.ts
 */
export {
  rateLimitService,
  RateLimitService,
  type RateLimitResult,
  type ConsumeRateLimitInput,
  type RateLimitWindow
} from "@/src/services/rate-limit.service";

import {
  rateLimitService,
  messageRateLimitConfig,
  fileUploadRateLimitConfig,
  type ConsumeRateLimitInput,
  type RateLimitResult
} from "@/src/services/rate-limit.service";

export const messageRateLimit = messageRateLimitConfig;
export const fileUploadRateLimit = fileUploadRateLimitConfig;

export async function consumeRateLimit(input: ConsumeRateLimitInput): Promise<RateLimitResult> {
  return rateLimitService.consume(input);
}

export function formatRateLimitMessage(result: RateLimitResult): string {
  return rateLimitService.formatMessage(result);
}
