import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { repository, type Repository } from "../services/repository.js";

export async function dashboardRoutes(app: FastifyInstance, repo: Repository = repository) {
  app.get("/api/dashboard/summary", { preHandler: requireAuth }, async (request) => {
    return await repo.dashboardSummary(request.auth!.userId);
  });
}
