import type { FastifyInstance } from "fastify";
import {
  CreateReadingDocumentSchema,
  TranslateReadingParagraphSchema,
  UpdateReadingDocumentSchema,
} from "@inko/shared";
import { repository, type Repository } from "../services/repository";
import { requireAuth } from "../plugins/auth";
import { rethrowAsHttp } from "../lib/http";
import { translationService, type TranslationService } from "../lib/translation";

export async function readingRoutes(
  app: FastifyInstance,
  repo: Repository = repository,
  translator: TranslationService = translationService,
) {
  app.get("/api/readings", { preHandler: requireAuth }, async (request) => {
    try {
      return await repo.listReadingDocuments(request.auth!.userId);
    } catch (error) {
      rethrowAsHttp(app, error);
    }
  });

  app.post("/api/readings", { preHandler: requireAuth }, async (request) => {
    try {
      const body = CreateReadingDocumentSchema.parse(request.body);
      return await repo.createReadingDocument(request.auth!.userId, body);
    } catch (error) {
      rethrowAsHttp(app, error);
    }
  });

  app.get("/api/readings/:documentId", { preHandler: requireAuth }, async (request) => {
    try {
      const { documentId } = request.params as { documentId: string };
      return await repo.getReadingDocument(request.auth!.userId, documentId);
    } catch (error) {
      rethrowAsHttp(app, error);
    }
  });

  app.patch("/api/readings/:documentId", { preHandler: requireAuth }, async (request) => {
    try {
      const { documentId } = request.params as { documentId: string };
      const body = UpdateReadingDocumentSchema.parse(request.body);
      return await repo.updateReadingDocument(request.auth!.userId, documentId, body);
    } catch (error) {
      rethrowAsHttp(app, error);
    }
  });

  app.delete("/api/readings/:documentId", { preHandler: requireAuth }, async (request) => {
    try {
      const { documentId } = request.params as { documentId: string };
      return await repo.deleteReadingDocument(request.auth!.userId, documentId);
    } catch (error) {
      rethrowAsHttp(app, error);
    }
  });

  app.post("/api/readings/translate", { preHandler: requireAuth }, async (request) => {
    try {
      const body = TranslateReadingParagraphSchema.parse(request.body);
      return await translator.translateParagraph(body);
    } catch (error) {
      rethrowAsHttp(app, error);
    }
  });
}
