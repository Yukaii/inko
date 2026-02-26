import type { FastifyInstance } from "fastify";
import {
  CreateDeckSchema,
  CreateWordSchema,
  UpdateDeckSchema,
  UpdateWordSchema,
} from "@inko/shared";
import { repository } from "../services/repository.js";
import { requireAuth } from "../plugins/auth.js";

export async function deckRoutes(app: FastifyInstance) {
  app.get("/api/decks", { preHandler: requireAuth }, async (request) => {
    return await repository.listDecks(request.auth!.userId);
  });

  app.post("/api/decks", { preHandler: requireAuth }, async (request) => {
    const body = CreateDeckSchema.parse(request.body);
    return await repository.createDeck(request.auth!.userId, body);
  });

  app.patch("/api/decks/:deckId", { preHandler: requireAuth }, async (request) => {
    const body = UpdateDeckSchema.parse(request.body);
    const { deckId } = request.params as { deckId: string };
    return await repository.updateDeck(deckId, body);
  });

  app.get("/api/decks/:deckId/words", { preHandler: requireAuth }, async (request) => {
    const { deckId } = request.params as { deckId: string };
    return await repository.listDeckWords(deckId);
  });

  app.post("/api/decks/:deckId/words", { preHandler: requireAuth }, async (request) => {
    const body = CreateWordSchema.parse(request.body);
    const { deckId } = request.params as { deckId: string };
    return await repository.createWord(request.auth!.userId, deckId, body);
  });

  app.patch("/api/words/:wordId", { preHandler: requireAuth }, async (request) => {
    const body = UpdateWordSchema.parse(request.body);
    const { wordId } = request.params as { wordId: string };
    return await repository.updateWord(wordId, body);
  });

  app.delete("/api/words/:wordId", { preHandler: requireAuth }, async (request) => {
    const { wordId } = request.params as { wordId: string };
    return await repository.deleteWord(wordId);
  });
}
