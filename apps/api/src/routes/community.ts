import type { FastifyInstance } from "fastify";
import {
  CreateCommunityDeckCommentSchema,
  CreateCommunityDeckSubmissionSchema,
  LanguageSchema,
  RateCommunityDeckSchema,
  ReviewCommunityDeckSubmissionSchema,
  type CommunitySubmissionStatus,
} from "@inko/shared";
import { repository, type Repository } from "../services/repository";
import { requireAuth } from "../plugins/auth";
import { rethrowAsHttp } from "../lib/http";
import { verifyAccessToken } from "../lib/auth";

async function getOptionalViewerUserId(request: { headers: { authorization?: string } }) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return undefined;

  try {
    const payload = await verifyAccessToken(authHeader.slice("Bearer ".length));
    return payload.userId;
  } catch {
    return undefined;
  }
}

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
      const viewerUserId = await getOptionalViewerUserId(request);
      return await repo.getPublishedCommunityDeckBySlug(slug, viewerUserId);
    } catch (error) {
      rethrowAsHttp(app, error);
    }
  });

  app.post("/api/community/decks/:slug/rating", { preHandler: requireAuth }, async (request) => {
    try {
      const body = RateCommunityDeckSchema.parse(request.body);
      const { slug } = request.params as { slug: string };
      return await repo.rateCommunityDeck(request.auth!.userId, slug, body);
    } catch (error) {
      rethrowAsHttp(app, error);
    }
  });

  app.post("/api/community/decks/:slug/comments", { preHandler: requireAuth }, async (request) => {
    try {
      const body = CreateCommunityDeckCommentSchema.parse(request.body);
      const { slug } = request.params as { slug: string };
      return await repo.addCommunityDeckComment(request.auth!.userId, slug, body);
    } catch (error) {
      rethrowAsHttp(app, error);
    }
  });

  app.delete("/api/community/decks/:slug/comments/:commentId", { preHandler: requireAuth }, async (request) => {
    try {
      const { slug, commentId } = request.params as { slug: string; commentId: string };
      return await repo.deleteCommunityDeckComment(request.auth!.userId, slug, commentId);
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

  app.delete("/api/community/submissions/:submissionId", { preHandler: requireAuth }, async (request) => {
    try {
      const { submissionId } = request.params as { submissionId: string };
      return await repo.deleteMyCommunityDeckSubmission(request.auth!.userId, submissionId);
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
