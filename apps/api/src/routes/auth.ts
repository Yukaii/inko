import type { FastifyInstance } from "fastify";
import {
  ErrorCode,
  MagicLinkRequestSchema,
  MagicLinkVerifySchema,
  UpdatePreferencesSchema,
  UpdateProfileSchema,
} from "@inko/shared";
import {
  consumeMagicToken,
  createMagicToken,
  issueAccessToken,
} from "../lib/auth";
import type { Mailer } from "../lib/mailer";
import {
  buildFrontendOAuthErrorUrl,
  buildFrontendOAuthSuccessUrl,
  buildOAuthAuthorizationUrl,
  exchangeOAuthCodeForIdentity,
  verifyOAuthState,
  type OAuthProvider,
} from "../lib/oauth";
import { repository, type Repository } from "../services/repository";
import { requireAuth } from "../plugins/auth";

export async function authRoutes(app: FastifyInstance, repo: Repository = repository, mailer: Mailer) {
  app.post("/api/auth/magic-link/request", async (request) => {
    const body = MagicLinkRequestSchema.parse(request.body);
    const email = body.email.toLowerCase();
    const token = createMagicToken(email);

    try {
      await mailer.sendMagicLink({ email, token });
      app.log.info({ email, mailProvider: mailer.kind }, "magic link sent");
    } catch (error) {
      app.log.error({ err: error, email, mailProvider: mailer.kind }, "failed to send magic link");
      const err = app.httpErrors.serviceUnavailable("Failed to send magic link");
      (err as any).code = ErrorCode.SERVICE_UNAVAILABLE;
      throw err;
    }

    return mailer.kind === "log" ? { ok: true, devToken: token } : { ok: true };
  });

  app.post("/api/auth/magic-link/verify", async (request, reply) => {
    const body = MagicLinkVerifySchema.parse(request.body);
    const email = consumeMagicToken(body.token);

    if (!email) {
      return reply.status(400).send({
        statusCode: 400,
        code: ErrorCode.INVALID_TOKEN,
        error: "Bad Request",
        message: "Invalid or expired token",
      });
    }

    const user = await repo.getOrCreateUser(email);
    const accessToken = await issueAccessToken(user.id, user.email);

    return { accessToken, user };
  });

  app.get("/api/auth/:provider/start", async (request, reply) => {
    const { provider } = request.params as { provider: OAuthProvider };
    const { redirectTo } = request.query as { redirectTo?: string };

    if (provider !== "github" && provider !== "google") {
      return reply.status(404).send({
        statusCode: 404,
        error: "Not Found",
        message: "OAuth provider not found",
      });
    }

    try {
      const url = await buildOAuthAuthorizationUrl(provider, request, redirectTo);
      return reply.redirect(url);
    } catch (error) {
      app.log.warn({ err: error, provider }, "failed to start oauth flow");
      return reply.redirect(buildFrontendOAuthErrorUrl("OAuth is not configured"));
    }
  });

  app.get("/api/auth/:provider/callback", async (request, reply) => {
    const { provider } = request.params as { provider: OAuthProvider };
    const { code, state, error } = request.query as {
      code?: string;
      state?: string;
      error?: string;
    };

    if (provider !== "github" && provider !== "google") {
      return reply.redirect(buildFrontendOAuthErrorUrl("Unknown OAuth provider"));
    }

    if (error) {
      return reply.redirect(buildFrontendOAuthErrorUrl(error));
    }

    if (!code || !state) {
      return reply.redirect(buildFrontendOAuthErrorUrl("Missing OAuth callback parameters"));
    }

    try {
      const verifiedState = await verifyOAuthState(state);
      if (verifiedState.provider !== provider) {
        throw new Error("OAuth state/provider mismatch");
      }

      const identity = await exchangeOAuthCodeForIdentity(provider, request, code);
      const user = await repo.getOrCreateUser(identity.email);
      const accessToken = await issueAccessToken(user.id, user.email);
      return reply.redirect(buildFrontendOAuthSuccessUrl(accessToken, verifiedState.redirectTo));
    } catch (oauthError) {
      app.log.warn({ err: oauthError, provider }, "oauth callback failed");
      return reply.redirect(buildFrontendOAuthErrorUrl("OAuth login failed"));
    }
  });

  app.post("/api/auth/logout", async () => {
    return { ok: true };
  });

  app.get("/api/me", { preHandler: requireAuth }, async (request, reply) => {
    const user = await repo.getUserById(request.auth!.userId);
    if (!user) {
      return reply.status(404).send({
        statusCode: 404,
        code: ErrorCode.USER_NOT_FOUND,
        error: "Not Found",
        message: "User not found",
      });
    }
    return user;
  });

  app.patch("/api/me", { preHandler: requireAuth }, async (request, reply) => {
    const body = UpdateProfileSchema.parse(request.body);
    const user = await repo.updateUserProfile(request.auth!.userId, body);
    if (!user) {
      return reply.status(404).send({
        statusCode: 404,
        code: ErrorCode.USER_NOT_FOUND,
        error: "Not Found",
        message: "User not found",
      });
    }
    return user;
  });

  app.patch("/api/me/preferences", { preHandler: requireAuth }, async (request, reply) => {
    const body = UpdatePreferencesSchema.parse(request.body);
    const user = await repo.updateUserPreferences(request.auth!.userId, body);
    if (!user) {
      return reply.status(404).send({
        statusCode: 404,
        code: ErrorCode.USER_NOT_FOUND,
        error: "Not Found",
        message: "User not found",
      });
    }
    return user;
  });
}
