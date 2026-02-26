import type { FastifyInstance } from "fastify";
import { MagicLinkRequestSchema, MagicLinkVerifySchema } from "@inko/shared";
import { consumeMagicToken, createMagicToken, issueAccessToken } from "../lib/auth.js";
import { repository } from "../services/repository.js";
import { requireAuth } from "../plugins/auth.js";

export async function authRoutes(app: FastifyInstance) {
  app.post("/api/auth/magic-link/request", async (request) => {
    const body = MagicLinkRequestSchema.parse(request.body);
    const token = createMagicToken(body.email.toLowerCase());

    app.log.info({ email: body.email, token }, "magic link token generated");
    return { ok: true };
  });

  app.post("/api/auth/magic-link/verify", async (request, reply) => {
    const body = MagicLinkVerifySchema.parse(request.body);
    const email = consumeMagicToken(body.token);

    if (!email) {
      return reply.badRequest("Invalid or expired token");
    }

    const user = await repository.getOrCreateUser(email);
    const accessToken = await issueAccessToken(user.id, user.email);

    return { accessToken, user };
  });

  app.post("/api/auth/logout", async () => {
    return { ok: true };
  });

  app.get("/api/me", { preHandler: requireAuth }, async (request, reply) => {
    const user = await repository.getUserById(request.auth!.userId);
    if (!user) {
      return reply.notFound("User not found");
    }
    return user;
  });
}
