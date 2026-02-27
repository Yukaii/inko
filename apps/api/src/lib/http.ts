import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { RepositoryError } from "../services/repository";

export function rethrowAsHttp(app: FastifyInstance, error: unknown): never {
  if (error instanceof RepositoryError) {
    switch (error.statusCode) {
      case 403:
        throw app.httpErrors.forbidden(error.message);
      case 404:
        throw app.httpErrors.notFound(error.message);
      case 409:
        throw app.httpErrors.conflict(error.message);
      default:
        throw app.httpErrors.internalServerError(error.message);
    }
  }

  if (error instanceof ZodError) {
    throw app.httpErrors.badRequest(error.message);
  }

  throw error;
}
