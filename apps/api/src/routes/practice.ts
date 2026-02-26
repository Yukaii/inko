import type { FastifyInstance } from "fastify";
import {
  StartPracticeSessionSchema,
  SubmitPracticeCardSchema,
} from "@inko/shared";
import { repository } from "../services/repository.js";
import { requireAuth } from "../plugins/auth.js";

export async function practiceRoutes(app: FastifyInstance) {
  app.post("/api/practice/session/start", { preHandler: requireAuth }, async (request) => {
    const body = StartPracticeSessionSchema.parse(request.body);
    return await repository.startPracticeSession(request.auth!.userId, body);
  });

  app.post(
    "/api/practice/session/:sessionId/card/submit",
    { preHandler: requireAuth },
    async (request) => {
      const body = SubmitPracticeCardSchema.parse(request.body);
      const { sessionId } = request.params as { sessionId: string };
      const { wordId } = request.query as { wordId: string };

      if (!wordId) {
        throw app.httpErrors.badRequest("wordId query param is required");
      }

      return await repository.submitPracticeCard(request.auth!.userId, sessionId, wordId, body);
    },
  );

  app.post(
    "/api/practice/session/:sessionId/finish",
    { preHandler: requireAuth },
    async (request) => {
      const { sessionId } = request.params as { sessionId: string };
      return await repository.finishPracticeSession(sessionId);
    },
  );
}
