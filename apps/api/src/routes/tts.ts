import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth";
import { rethrowAsHttp } from "../lib/http";
import { ttsService, type TtsService } from "../lib/tts";

export async function ttsRoutes(
  app: FastifyInstance,
  service: TtsService = ttsService,
) {
  app.get("/api/words/:wordId/tts", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { wordId } = request.params as { wordId: string };
      const audio = await service.synthesizeWordAudio({
        userId: request.auth!.userId,
        wordId,
        targetHint: wordId,
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
