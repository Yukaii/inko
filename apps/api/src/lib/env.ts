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
});

const parsedEnv = EnvSchema.parse(process.env);

if (parsedEnv.MAIL_PROVIDER === "resend" && !parsedEnv.RESEND_API_KEY) {
  throw new Error("RESEND_API_KEY is required when MAIL_PROVIDER=resend");
}

export const env = {
  ...parsedEnv,
  MAGIC_LINK_LOGIN_URL: parsedEnv.MAGIC_LINK_LOGIN_URL ?? `${parsedEnv.FRONTEND_URL}/login`,
};
