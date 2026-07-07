import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const EnvSchema = z.object({
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1).default("postgres://postgres:postgres@127.0.0.1:5432/inko"),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
  API_PUBLIC_URL: z.string().url().default("http://localhost:4000"),
  JWT_SECRET: z.string().min(16).default("dev_only_change_this_secret"),
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),
  MAGIC_LINK_LOGIN_URL: z.string().url().optional(),
  MAIL_PROVIDER: z.enum(["log", "resend"]).default("log"),
  RESEND_API_KEY: z.string().min(1).optional(),
  MAIL_FROM: z.string().min(1).default("Inkō <no-reply@localhost>"),
  AUTH_GOOGLE_ID: z.string().min(1).optional(),
  AUTH_GOOGLE_SECRET: z.string().min(1).optional(),
  AUTH_GITHUB_ID: z.string().min(1).optional(),
  AUTH_GITHUB_SECRET: z.string().min(1).optional(),
  OBJECT_STORAGE_ENDPOINT: z.string().url().optional(),
  OBJECT_STORAGE_REGION: z.string().default("garage"),
  OBJECT_STORAGE_BUCKET: z.string().min(1).optional(),
  OBJECT_STORAGE_ACCESS_KEY_ID: z.string().min(1).optional(),
  OBJECT_STORAGE_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  OBJECT_STORAGE_FORCE_PATH_STYLE: z.coerce.boolean().default(true),
  PRACTICE_TRACE_SLOW_MS: z.coerce.number().int().nonnegative().default(1000),
  MODERATOR_EMAILS: z.string().default(""),
  STATIC_ASSETS_DIR: z.string().min(1).optional(),
  TRANSLATION_PROVIDER: z.enum(["fallback", "openai", "openai_compatible", "opencode_zen", "vercel_gateway"]).default("fallback"),
  TRANSLATION_API_URL: z.string().url().optional(),
  TRANSLATION_BASE_URL: z.string().url().optional(),
  TRANSLATION_API_KEY: z.string().min(1).optional(),
  TRANSLATION_MODEL: z.string().min(1).default("gpt-4o-mini"),
  TRANSLATION_OPENAI_COMPATIBLE_NAME: z.string().min(1).default("openai-compatible"),
  TRANSLATION_SUPPORTS_STRUCTURED_OUTPUTS: z.coerce.boolean().default(true),
  OPENAI_API_KEY: z.string().min(1).optional(),
  AI_GATEWAY_API_KEY: z.string().min(1).optional(),
  AI_GATEWAY_BASE_URL: z.string().url().optional(),
  OPENCODE_ZEN_BASE_URL: z.string().url().optional(),
  OPENCODE_ZEN_API_KEY: z.string().min(1).optional(),
});

const parsedEnv = EnvSchema.parse(process.env);

if (parsedEnv.MAIL_PROVIDER === "resend" && !parsedEnv.RESEND_API_KEY) {
  throw new Error("RESEND_API_KEY is required when MAIL_PROVIDER=resend");
}

if (parsedEnv.TRANSLATION_PROVIDER === "openai" && !(parsedEnv.OPENAI_API_KEY || parsedEnv.TRANSLATION_API_KEY)) {
  throw new Error("OPENAI_API_KEY or TRANSLATION_API_KEY is required when TRANSLATION_PROVIDER=openai");
}

if (parsedEnv.TRANSLATION_PROVIDER === "openai_compatible" && (!(parsedEnv.TRANSLATION_BASE_URL || parsedEnv.TRANSLATION_API_URL) || !parsedEnv.TRANSLATION_API_KEY)) {
  throw new Error("TRANSLATION_BASE_URL (or TRANSLATION_API_URL) and TRANSLATION_API_KEY are required when TRANSLATION_PROVIDER=openai_compatible");
}

if (parsedEnv.TRANSLATION_PROVIDER === "opencode_zen" && (!(parsedEnv.OPENCODE_ZEN_BASE_URL || parsedEnv.TRANSLATION_BASE_URL || parsedEnv.TRANSLATION_API_URL) || !(parsedEnv.OPENCODE_ZEN_API_KEY || parsedEnv.TRANSLATION_API_KEY))) {
  throw new Error("OPENCODE_ZEN_BASE_URL and OPENCODE_ZEN_API_KEY are required when TRANSLATION_PROVIDER=opencode_zen");
}

if (parsedEnv.TRANSLATION_PROVIDER === "vercel_gateway" && !(parsedEnv.AI_GATEWAY_API_KEY || parsedEnv.TRANSLATION_API_KEY)) {
  throw new Error("AI_GATEWAY_API_KEY or TRANSLATION_API_KEY is required when TRANSLATION_PROVIDER=vercel_gateway");
}

export const env = {
  ...parsedEnv,
  MAGIC_LINK_LOGIN_URL: parsedEnv.MAGIC_LINK_LOGIN_URL ?? `${parsedEnv.FRONTEND_URL}/login`,
};
