import type { FastifyInstance } from "fastify";
import { repository, type Repository } from "../services/repository";
import { requireAuth } from "../plugins/auth";
import { rethrowAsHttp } from "../lib/http";

export async function importRoutes(app: FastifyInstance, repo: Repository = repository) {
  app.post("/api/imports/audio", { preHandler: requireAuth }, async (request) => {
    try {
      const file = await request.file();
      if (!file) {
        throw app.httpErrors.badRequest("Audio file is required.");
      }

      const chunks: Buffer[] = [];
      for await (const chunk of file.file) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      if (chunks.length === 0) {
        throw app.httpErrors.badRequest("Uploaded audio file was empty.");
      }

      return await repo.storeImportedAudio(request.auth!.userId, {
        filename: file.filename,
        contentType: file.mimetype || "application/octet-stream",
        bytes: Buffer.concat(chunks),
      });
    } catch (error) {
      rethrowAsHttp(app, error);
    }
  });
}
