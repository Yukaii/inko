# Architecture

Monorepo with 4 main parts:

- `apps/web` - React client
- `apps/api` - Fastify API
- `convex` - schema + DB functions
- `packages/shared` - shared schemas and domain logic

Request flow: `web -> api -> convex`, with shared validation/types from `@inko/shared`.
