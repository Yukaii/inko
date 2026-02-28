import type { FastifyInstance } from "fastify";
import {
  StartPracticeSessionSchema,
  SubmitPracticeCardSchema,
} from "@inko/shared";
import { repository, type Repository } from "../services/repository";
import { requireAuth } from "../plugins/auth";
import { rethrowAsHttp } from "../lib/http";

export async function practiceRoutes(app: FastifyInstance, repo: Repository = repository) {
  app.get(
    "/api/practice/session/:sessionId",
    { preHandler: requireAuth },
    async (request) => {
      try {
        const { sessionId } = request.params as { sessionId: string };
        return await repo.getPracticeSessionDetails(request.auth!.userId, sessionId);
      } catch (error) {
        rethrowAsHttp(app, error);
      }
    },
  );

  app.post("/api/practice/session/start", { preHandler: requireAuth }, async (request) => {
    try {
      const body = StartPracticeSessionSchema.parse(request.body);
      return await repo.startPracticeSession(request.auth!.userId, body);
    } catch (error) {
      rethrowAsHttp(app, error);
    }
  });

  app.post(
    "/api/practice/session/:sessionId/card/submit",
    { preHandler: requireAuth },
    async (request) => {
      try {
        const body = SubmitPracticeCardSchema.parse(request.body);
        const { sessionId } = request.params as { sessionId: string };
        const { wordId } = request.query as { wordId: string };

        if (!wordId) {
          throw app.httpErrors.badRequest("wordId query param is required");
        }

        return await repo.submitPracticeCard(request.auth!.userId, sessionId, wordId, body);
      } catch (error) {
        rethrowAsHttp(app, error);
      }
    },
  );

  app.post(
    "/api/practice/session/:sessionId/finish",
    { preHandler: requireAuth },
    async (request) => {
      try {
        const { sessionId } = request.params as { sessionId: string };
        return await repo.finishPracticeSession(request.auth!.userId, sessionId);
      } catch (error) {
        rethrowAsHttp(app, error);
      }
    },
  );
}
