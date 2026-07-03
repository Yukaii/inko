# Architecture

Monorepo with 4 main parts:

- `apps/web` - React client
- `apps/api` - Fastify API
- `postgres` - primary relational store accessed through Kysely
- `packages/shared` - shared schemas and domain logic

Request flow: `web -> api -> postgres`, with shared validation/types from `@inko/shared`.

Production monolith flow: Fastify serves `/api/*`, `/health`, and the built Vite app from `apps/web/dist`. Browser routes fall back to `index.html`, so Vercel can deploy the frontend and backend as one Docker container from `Dockerfile.vercel`.
