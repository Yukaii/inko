import type { FastifyInstance } from "fastify";
import { repository, type Repository } from "../services/repository";
import { requireAuth } from "../plugins/auth";
import { rethrowAsHttp } from "../lib/http";
import { ttsService, type TtsService } from "../lib/tts";

export async function ttsRoutes(
  app: FastifyInstance,
  repo: Repository = repository,
  service: TtsService = ttsService,
) {
  app.get("/api/words/:wordId/tts", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { wordId } = request.params as { wordId: string };
      const { deckId, voice, rate } = request.query as {
        deckId?: string;
        voice?: string;
        rate?: "-20%" | "default" | "+20%";
      };
      if (!deckId) {
        reply.code(400);
        return { message: "deckId is required" };
      }
      const word = await repo.getWordById(request.auth!.userId, wordId);
      const audio = await service.synthesizeWordAudio({
        userId: request.auth!.userId,
        deckId,
        wordId,
        targetHint: word.target,
        voice,
        rate,
      });

      reply.header("content-type", audio.contentType);
      reply.header("content-disposition", `inline; filename="${audio.fileName}"`);
      reply.header("cache-control", "private, max-age=86400");
      return reply.send(audio.audio);
    } catch (error) {
      rethrowAsHttp(app, error);
    }
  });
}
