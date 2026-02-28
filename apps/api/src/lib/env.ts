import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const EnvSchema = z.object({
  PORT: z.coerce.number().default(4000),
  CONVEX_URL: z.string().url().default("http://127.0.0.1:3210"),
  JWT_SECRET: z.string().min(16).default("dev_only_change_this_secret"),
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),
  MAGIC_LINK_LOGIN_URL: z.string().url().optional(),
  MAIL_PROVIDER: z.enum(["log", "resend"]).default("log"),
  RESEND_API_KEY: z.string().min(1).optional(),
  MAIL_FROM: z.string().min(1).default("Inkō <no-reply@localhost>"),
  PRACTICE_TRACE_SLOW_MS: z.coerce.number().int().nonnegative().default(1000),
});

const parsedEnv = EnvSchema.parse(process.env);

if (parsedEnv.MAIL_PROVIDER === "resend" && !parsedEnv.RESEND_API_KEY) {
  throw new Error("RESEND_API_KEY is required when MAIL_PROVIDER=resend");
}

export const env = {
  ...parsedEnv,
  MAGIC_LINK_LOGIN_URL: parsedEnv.MAGIC_LINK_LOGIN_URL ?? `${parsedEnv.FRONTEND_URL}/login`,
};
