import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const EnvSchema = z.object({
  PORT: z.coerce.number().default(4000),
  CONVEX_URL: z.string().url().default("http://127.0.0.1:3210"),
  JWT_SECRET: z.string().min(16).default("dev_only_change_this_secret"),
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),
});

export const env = EnvSchema.parse(process.env);
