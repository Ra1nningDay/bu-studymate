import { z } from "zod";

const booleanSchema = (defaultValue = true) =>
  z.preprocess((val) => {
    if (typeof val === "string") {
      const lower = val.trim().toLowerCase();
      if (lower === "false" || lower === "0") return false;
      if (lower === "true" || lower === "1") return true;
    }
    return val;
  }, z.boolean().default(defaultValue));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_URL: z.string().optional(),

  // LINE Bot
  LINE_CHANNEL_ACCESS_TOKEN: z.string().optional(),
  LINE_CHANNEL_SECRET: z.string().optional(),

  // AI & OpenRouter / OpenAI
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-6-luna"),
  OPENAI_AGENT_ROUTER_MODEL: z.string().default("gpt-6-luna"),
  OPENAI_WEB_SEARCH_MODEL: z.string().default("gpt-6-luna"),
  OPENROUTER_API_KEY: z.string().optional(),
  AGENT_ROUTER_MODE: z.enum(["openai", "shadow", "jev"]).default("jev"),
  JEV_ROUTER_MODEL: z.string().min(1).default("typesafe/jev-1.13"),
  JEV_ROUTER_MIN_PROBABILITY: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.coerce.number().min(0).max(1).default(0.8)
  ),

  // Admin & App URL
  ADMIN_USERNAME: z.string().default("admin"),
  ADMIN_PASSWORD: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().optional(),
  APP_URL: z.string().optional(),
  CRON_SECRET: z.string().min(32).optional(),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),

  // Study Memory & OCR settings
  STUDY_MEMORY_MAX_FILE_BYTES: z.coerce.number().positive().default(10485760), // 10MB
  STUDY_MEMORY_OCR_ENABLED: booleanSchema(true),
  STUDY_MEMORY_OCR_LANG: z.string().default("tha+eng"),
  STUDY_MEMORY_OCR_MAX_PAGES: z.coerce.number().positive().default(5),
  STUDY_MEMORY_OCR_SCALE: z.coerce.number().positive().default(2),
  STUDY_MEMORY_PDF_TEXT_MIN_CHARS: z.coerce.number().positive().default(80)
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  if (process.env.SKIP_ENV_VALIDATION === "true") {
    return process.env as unknown as Env;
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("❌ Invalid environment variables:", result.error.format());
    throw new Error(
      `Invalid environment variables: ${JSON.stringify(result.error.flatten().fieldErrors, null, 2)}`
    );
  }

  return result.data;
}

export const env = validateEnv();
