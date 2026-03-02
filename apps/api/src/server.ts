import Fastify, { type FastifyError } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import sensible from "@fastify/sensible";
import { ErrorCode } from "@inko/shared";
import { env } from "./lib/env";
import { createMailer, type Mailer } from "./lib/mailer";
import { ttsService, type TtsService } from "./lib/tts";
import { setPracticeTraceSink } from "./lib/diagnostics";
import { authRoutes } from "./routes/auth";
import { deckRoutes } from "./routes/decks";
import { practiceRoutes } from "./routes/practice";
import { dashboardRoutes } from "./routes/dashboard";
import { communityRoutes } from "./routes/community";
import { importRoutes } from "./routes/imports";
import { ttsRoutes } from "./routes/tts";
import { repository, type Repository } from "./services/repository";

export async function buildServer(options?: { repository?: Repository; mailer?: Mailer; ttsService?: TtsService }) {
  const app = Fastify({ logger: true });
  setPracticeTraceSink((payload, message) => {
    app.log.info(payload, message);
  });
  const repo = options?.repository ?? repository;
  const mailer = options?.mailer ?? createMailer();
  const tts = options?.ttsService ?? ttsService;

  app.setErrorHandler((error: FastifyError, request, reply) => {
    app.log.error(error);

    if (error.validation) {
      return reply.status(400).send({
        statusCode: 400,
        code: ErrorCode.VALIDATION_ERROR,
        error: "Bad Request",
        message: error.message,
      });
    }

    const statusCode = error.statusCode || 500;
    const code = error.code || (statusCode >= 500 ? ErrorCode.INTERNAL_ERROR : undefined);

    reply.status(statusCode).send({
      statusCode,
      code,
      error: error.name,
      message: error.message,
    });
  });

  await app.register(cors, {
    origin: [env.FRONTEND_URL],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  });
  await app.register(sensible);
  await app.register(multipart, {
    limits: {
      files: 1,
      fileSize: 10 * 1024 * 1024,
    },
  });

  await app.register(async (instance) => authRoutes(instance, repo, mailer));
  await app.register(async (instance) => deckRoutes(instance, repo));
  await app.register(async (instance) => importRoutes(instance, repo));
  await app.register(async (instance) => practiceRoutes(instance, repo));
  await app.register(async (instance) => dashboardRoutes(instance, repo));
  await app.register(async (instance) => communityRoutes(instance, repo));
  await app.register(async (instance) => ttsRoutes(instance, tts));

  app.get("/health", async () => ({ ok: true }));

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = await buildServer();
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
}
