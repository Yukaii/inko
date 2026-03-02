import type { FastifyInstance } from "fastify";
import {
  CreateCommunityDeckSubmissionSchema,
  LanguageSchema,
  ReviewCommunityDeckSubmissionSchema,
  type CommunitySubmissionStatus,
} from "@inko/shared";
import { repository, type Repository } from "../services/repository";
import { requireAuth } from "../plugins/auth";
import { rethrowAsHttp } from "../lib/http";

export async function communityRoutes(app: FastifyInstance, repo: Repository = repository) {
  app.get("/api/community/decks", async (request) => {
    try {
      const query = request.query as { language?: string; search?: string };
      const language = query.language ? LanguageSchema.parse(query.language) : undefined;
      return await repo.listPublishedCommunityDecks({
        language,
        search: query.search,
      });
    } catch (error) {
      rethrowAsHttp(app, error);
    }
  });

  app.get("/api/community/decks/:slug", async (request) => {
    try {
      const { slug } = request.params as { slug: string };
      return await repo.getPublishedCommunityDeckBySlug(slug);
    } catch (error) {
      rethrowAsHttp(app, error);
    }
  });

  app.post("/api/community/submissions", { preHandler: requireAuth }, async (request) => {
    try {
      const body = CreateCommunityDeckSubmissionSchema.parse(request.body);
      return await repo.createCommunityDeckSubmission(request.auth!.userId, body);
    } catch (error) {
      rethrowAsHttp(app, error);
    }
  });

  app.get("/api/community/submissions/mine", { preHandler: requireAuth }, async (request) => {
    try {
      return await repo.listMyCommunityDeckSubmissions(request.auth!.userId);
    } catch (error) {
      rethrowAsHttp(app, error);
    }
  });

  app.get("/api/community/submissions", { preHandler: requireAuth }, async (request) => {
    try {
      const query = request.query as { status?: CommunitySubmissionStatus };
      return await repo.listCommunityDeckSubmissions(request.auth!.userId, query.status);
    } catch (error) {
      rethrowAsHttp(app, error);
    }
  });

  app.post("/api/community/submissions/:submissionId/review", { preHandler: requireAuth }, async (request) => {
    try {
      const body = ReviewCommunityDeckSubmissionSchema.parse(request.body);
      const { submissionId } = request.params as { submissionId: string };
      return await repo.reviewCommunityDeckSubmission(request.auth!.userId, submissionId, body);
    } catch (error) {
      rethrowAsHttp(app, error);
    }
  });
}
