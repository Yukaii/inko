import type { FastifyInstance } from "fastify";
import { getDefaultEdgeTtsVoice } from "@inko/shared";
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
    const requestStartedAt = Date.now();
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
      app.log.info(
        {
          tts: {
            userId: request.auth!.userId,
            deckId,
            wordId,
            voice: voice ?? "default",
            rate: rate ?? "default",
          },
        },
        "tts request started",
      );
      const word = await repo.getWordById(request.auth!.userId, wordId);
      const audio = await service.synthesizeWordAudio({
        userId: request.auth!.userId,
        deckId,
        wordId,
        targetHint: word.target,
        voice,
        rate,
      });
      app.log.info(
        {
          tts: {
            userId: request.auth!.userId,
            deckId,
            wordId,
            source: audio.diagnostics?.source ?? "unknown",
            objectKey: audio.diagnostics?.objectKey ?? null,
            timingsMs: audio.diagnostics?.timingsMs ?? null,
            requestTotal: Date.now() - requestStartedAt,
          },
        },
        "tts request completed",
      );

      reply.header("content-type", audio.contentType);
      reply.header("content-disposition", `inline; filename="${audio.fileName}"`);
      reply.header("cache-control", "private, max-age=86400");
      return reply.send(audio.audio);
    } catch (error) {
      app.log.error(
        {
          err: error,
          tts: {
            requestTotal: Date.now() - requestStartedAt,
            path: request.url,
          },
        },
        "tts request failed",
      );
      rethrowAsHttp(app, error);
    }
  });

  app.get("/api/readings/:documentId/paragraphs/:paragraphId/tts", { preHandler: requireAuth }, async (request, reply) => {
    const requestStartedAt = Date.now();
    try {
      const { documentId, paragraphId } = request.params as { documentId: string; paragraphId: string };
      const { voice, rate } = request.query as {
        voice?: string;
        rate?: "-20%" | "default" | "+20%";
      };
      const document = await repo.getReadingDocument(request.auth!.userId, documentId);
      const paragraph = document.paragraphs.find((item) => item.id === paragraphId);
      if (!paragraph) {
        reply.code(404);
        return { message: "Reading paragraph not found" };
      }

      const audio = await service.synthesizeTextAudio({
        userId: request.auth!.userId,
        documentId,
        paragraphId,
        text: paragraph.source,
        voice: voice ?? getDefaultEdgeTtsVoice(document.sourceLanguage),
        rate,
      });

      app.log.info(
        {
          tts: {
            userId: request.auth!.userId,
            documentId,
            paragraphId,
            source: audio.diagnostics?.source ?? "unknown",
            objectKey: audio.diagnostics?.objectKey ?? null,
            timingsMs: audio.diagnostics?.timingsMs ?? null,
            requestTotal: Date.now() - requestStartedAt,
          },
        },
        "reading tts request completed",
      );

      reply.header("content-type", audio.contentType);
      reply.header("content-disposition", `inline; filename="${audio.fileName}"`);
      reply.header("cache-control", "private, max-age=86400");
      return reply.send(audio.audio);
    } catch (error) {
      app.log.error(
        {
          err: error,
          tts: {
            requestTotal: Date.now() - requestStartedAt,
            path: request.url,
          },
        },
        "reading tts request failed",
      );
      rethrowAsHttp(app, error);
    }
  });
}
