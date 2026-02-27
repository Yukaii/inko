import type { FastifyInstance } from "fastify";
import {
  CreateDeckSchema,
  CreateWordsBatchSchema,
  CreateWordSchema,
  DeleteWordsBatchSchema,
  UpdateDeckSchema,
  UpdateWordSchema,
} from "@inko/shared";
import { repository, type Repository } from "../services/repository";
import { requireAuth } from "../plugins/auth";
import { rethrowAsHttp } from "../lib/http";

export async function deckRoutes(app: FastifyInstance, repo: Repository = repository) {
  app.get("/api/decks", { preHandler: requireAuth }, async (request) => {
    try {
      return await repo.listDecks(request.auth!.userId);
    } catch (error) {
      rethrowAsHttp(app, error);
    }
  });

  app.post("/api/decks", { preHandler: requireAuth }, async (request) => {
    try {
      const body = CreateDeckSchema.parse(request.body);
      return await repo.createDeck(request.auth!.userId, body);
    } catch (error) {
      rethrowAsHttp(app, error);
    }
  });

  app.patch("/api/decks/:deckId", { preHandler: requireAuth }, async (request) => {
    try {
      const body = UpdateDeckSchema.parse(request.body);
      const { deckId } = request.params as { deckId: string };
      return await repo.updateDeck(request.auth!.userId, deckId, body);
    } catch (error) {
      rethrowAsHttp(app, error);
    }
  });

  app.get("/api/decks/:deckId/words/page", { preHandler: requireAuth }, async (request) => {
    try {
      const { deckId } = request.params as { deckId: string };
      const query = request.query as { cursor?: string; limit?: string };
      const cursor = query.cursor ?? null;
      const limit = query.limit ? Number.parseInt(query.limit, 10) : 100;
      return await repo.listDeckWordsPage(request.auth!.userId, deckId, cursor, limit);
    } catch (error) {
      rethrowAsHttp(app, error);
    }
  });

  app.post("/api/decks/:deckId/words", { preHandler: requireAuth }, async (request) => {
    try {
      const body = CreateWordSchema.parse(request.body);
      const { deckId } = request.params as { deckId: string };
      return await repo.createWord(request.auth!.userId, deckId, body);
    } catch (error) {
      rethrowAsHttp(app, error);
    }
  });

  app.post("/api/decks/:deckId/words/batch", { preHandler: requireAuth }, async (request) => {
    try {
      const body = CreateWordsBatchSchema.parse(request.body);
      const { deckId } = request.params as { deckId: string };
      const words = await repo.createWordsBatch(request.auth!.userId, deckId, body);
      return { created: words.length, words };
    } catch (error) {
      rethrowAsHttp(app, error);
    }
  });

  app.patch("/api/words/:wordId", { preHandler: requireAuth }, async (request) => {
    try {
      const body = UpdateWordSchema.parse(request.body);
      const { wordId } = request.params as { wordId: string };
      return await repo.updateWord(request.auth!.userId, wordId, body);
    } catch (error) {
      rethrowAsHttp(app, error);
    }
  });

  app.delete("/api/words/:wordId", { preHandler: requireAuth }, async (request) => {
    try {
      const { wordId } = request.params as { wordId: string };
      return await repo.deleteWord(request.auth!.userId, wordId);
    } catch (error) {
      rethrowAsHttp(app, error);
    }
  });

  app.post("/api/decks/:deckId/words/batch-delete", { preHandler: requireAuth }, async (request) => {
    try {
      const body = DeleteWordsBatchSchema.parse(request.body);
      const { deckId } = request.params as { deckId: string };
      return await repo.deleteWordsBatch(request.auth!.userId, deckId, body);
    } catch (error) {
      rethrowAsHttp(app, error);
    }
  });

  app.delete("/api/decks/:deckId", { preHandler: requireAuth }, async (request) => {
    try {
      const { deckId } = request.params as { deckId: string };
      return await repo.deleteDeck(request.auth!.userId, deckId);
    } catch (error) {
      rethrowAsHttp(app, error);
    }
  });
}
