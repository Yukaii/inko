import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import { env } from "./lib/env.js";
import { authRoutes } from "./routes/auth.js";
import { deckRoutes } from "./routes/decks.js";
import { practiceRoutes } from "./routes/practice.js";
import { dashboardRoutes } from "./routes/dashboard.js";

export async function buildServer() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: [env.FRONTEND_URL],
  });
  await app.register(sensible);

  await app.register(authRoutes);
  await app.register(deckRoutes);
  await app.register(practiceRoutes);
  await app.register(dashboardRoutes);

  app.get("/health", async () => ({ ok: true }));

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = await buildServer();
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
}
