import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth";
import { repository, type Repository } from "../services/repository";

export async function dashboardRoutes(app: FastifyInstance, repo: Repository = repository) {
  app.get("/api/dashboard/summary", { preHandler: requireAuth }, async (request, reply) => {
    reply.header("Cache-Control", "private, max-age=20, stale-while-revalidate=40");
    return await repo.dashboardSummary(request.auth!.userId);
  });

  app.get("/api/dashboard/stats", { preHandler: requireAuth }, async (request, reply) => {
    reply.header("Cache-Control", "private, max-age=20, stale-while-revalidate=40");
    return await repo.dashboardStats(request.auth!.userId);
  });

  app.get("/api/dashboard/recent-sessions", { preHandler: requireAuth }, async (request, reply) => {
    reply.header("Cache-Control", "private, max-age=20, stale-while-revalidate=40");
    return await repo.dashboardRecentSessions(request.auth!.userId);
  });
}
