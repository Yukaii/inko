import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import { env } from "./lib/env";
import { createMailer, type Mailer } from "./lib/mailer";
import { authRoutes } from "./routes/auth";
import { deckRoutes } from "./routes/decks";
import { practiceRoutes } from "./routes/practice";
import { dashboardRoutes } from "./routes/dashboard";
import { repository, type Repository } from "./services/repository";

export async function buildServer(options?: { repository?: Repository; mailer?: Mailer }) {
  const app = Fastify({ logger: true });
  const repo = options?.repository ?? repository;
  const mailer = options?.mailer ?? createMailer();

  await app.register(cors, {
    origin: [env.FRONTEND_URL],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  });
  await app.register(sensible);

  await app.register(async (instance) => authRoutes(instance, repo, mailer));
  await app.register(async (instance) => deckRoutes(instance, repo));
  await app.register(async (instance) => practiceRoutes(instance, repo));
  await app.register(async (instance) => dashboardRoutes(instance, repo));

  app.get("/health", async () => ({ ok: true }));

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = await buildServer();
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
}
