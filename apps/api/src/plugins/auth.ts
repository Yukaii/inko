import type { FastifyReply, FastifyRequest } from "fastify";
import { verifyAccessToken } from "../lib/auth.js";

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return reply.unauthorized("Missing bearer token");
  }

  const token = authHeader.slice("Bearer ".length);

  try {
    const payload = await verifyAccessToken(token);
    request.auth = { userId: payload.userId, email: payload.email };
  } catch (error) {
    return reply.unauthorized("Invalid token");
  }
}
