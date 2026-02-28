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
      const word = await repo.getWordById(request.auth!.userId, wordId);
      const audio = await service.synthesizeWordAudio({
        target: word.target,
        reading: word.reading,
        language: word.language,
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
