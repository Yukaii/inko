import type { FastifyInstance } from "fastify";
import { getObject } from "../lib/object-storage";
import { rethrowAsHttp } from "../lib/http";

export async function mediaRoutes(app: FastifyInstance) {
  app.get("/api/media", async (request, reply) => {
    try {
      const { key } = request.query as { key?: string };
      if (!key) {
        throw app.httpErrors.badRequest("key query param is required");
      }

      const object = await getObject(key);
      if (!object) {
        throw app.httpErrors.notFound("Media not found");
      }

      reply.header("content-type", object.contentType);
      reply.header("cache-control", "public, max-age=31536000, immutable");
      if (object.contentLength != null) {
        reply.header("content-length", String(object.contentLength));
      }
      return reply.send(object.body);
    } catch (error) {
      rethrowAsHttp(app, error);
    }
  });
}
