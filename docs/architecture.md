# Architecture

Monorepo with 4 main parts:

- `apps/web` - React client
- `apps/api` - Fastify API
- `postgres` - primary relational store accessed through Kysely
- `packages/shared` - shared schemas and domain logic

Request flow: `web -> api -> postgres`, with shared validation/types from `@inko/shared`.
