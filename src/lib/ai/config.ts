import { env } from "@/src/config/env";

export function isAiConfigured() {
  return Boolean(env.OPENAI_API_KEY);
}
