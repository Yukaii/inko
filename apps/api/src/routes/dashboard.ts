import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { repository } from "../services/repository.js";

export async function dashboardRoutes(app: FastifyInstance) {
  app.get("/api/dashboard/summary", { preHandler: requireAuth }, async (request) => {
    return await repository.dashboardSummary(request.auth!.userId);
  });
}
