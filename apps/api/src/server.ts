import Fastify, { type FastifyError } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import sensible from "@fastify/sensible";
import fastifyStatic from "@fastify/static";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { ErrorCode } from "@inko/shared";
import { env } from "./lib/env";
import { createMailer, type Mailer } from "./lib/mailer";
import { ttsService, type TtsService } from "./lib/tts";
import { setPracticeTraceSink } from "./lib/diagnostics";
import type { MagicTokenStore } from "./lib/auth";
import { closeDb } from "./db/client";
import { migrateToLatest } from "./db/migrator";
import { authRoutes } from "./routes/auth";
import { deckRoutes } from "./routes/decks";
import { practiceRoutes } from "./routes/practice";
import { dashboardRoutes } from "./routes/dashboard";
import { communityRoutes } from "./routes/community";
import { importRoutes } from "./routes/imports";
import { mediaRoutes } from "./routes/media";
import { ttsRoutes } from "./routes/tts";
import { repository, type Repository } from "./services/repository";

export async function buildServer(options?: {
  repository?: Repository;
  mailer?: Mailer;
  ttsService?: TtsService;
  magicTokenStore?: MagicTokenStore;
  skipMigrations?: boolean;
  staticAssetsDir?: string | false;
}) {
  if (!options?.skipMigrations) {
    await migrateToLatest();
  }
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

  await app.register(async (instance) => authRoutes(instance, repo, mailer, options?.magicTokenStore));
  await app.register(async (instance) => deckRoutes(instance, repo));
  await app.register(async (instance) => importRoutes(instance, repo));
  await app.register(async (instance) => mediaRoutes(instance));
  await app.register(async (instance) => practiceRoutes(instance, repo));
  await app.register(async (instance) => dashboardRoutes(instance, repo));
  await app.register(async (instance) => communityRoutes(instance, repo));
  await app.register(async (instance) => ttsRoutes(instance, repo, tts));

  app.get("/health", async () => ({ ok: true }));

  const staticAssetsDir = resolveStaticAssetsDir(options?.staticAssetsDir);
  if (staticAssetsDir) {
    await app.register(fastifyStatic, {
      root: staticAssetsDir,
      prefix: "/",
      wildcard: false,
    });

    app.get("/*", async (request, reply) => {
      const staticPath = getStaticPath(staticAssetsDir, request.url);
      if (!staticPath) {
        return reply.callNotFound();
      }

      return reply.sendFile(staticPath);
    });
  }

  app.addHook("onClose", async () => {
    await closeDb();
  });

  return app;
}

function resolveStaticAssetsDir(staticAssetsDir?: string | false) {
  if (staticAssetsDir === false) {
    return undefined;
  }

  const resolved = path.resolve(staticAssetsDir ?? env.STATIC_ASSETS_DIR ?? "apps/web/dist");
  return existsSync(resolved) ? resolved : undefined;
}

function getStaticPath(staticAssetsDir: string, requestUrl: string) {
  const pathname = new URL(requestUrl, "http://localhost").pathname;
  if (pathname.startsWith("/api/") || pathname === "/health") {
    return undefined;
  }

  let relativePath: string;
  try {
    relativePath = decodeURIComponent(pathname).replace(/^\/+/, "") || "index.html";
  } catch {
    return undefined;
  }

  const absolutePath = path.resolve(staticAssetsDir, relativePath);
  const rootPrefix = staticAssetsDir.endsWith(path.sep) ? staticAssetsDir : `${staticAssetsDir}${path.sep}`;

  if (absolutePath !== staticAssetsDir && !absolutePath.startsWith(rootPrefix)) {
    return undefined;
  }

  try {
    if (statSync(absolutePath).isFile()) {
      return relativePath;
    }
  } catch {
    // Fall back to the SPA shell for client-side routes.
  }

  return "index.html";
}

async function main() {
  const app = await buildServer();
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
}

if (require.main === module) {
  void main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
