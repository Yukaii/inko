# Backend

Backend is split between:

- `apps/api` - Fastify HTTP API
- `convex` - data schema + queries/mutations/actions

Common commands:

- `bun run --filter @inko/api dev`
- `bun run --filter @inko/api test`
- `bun run --filter @inko/api lint`
- `bun run --filter @inko/api build`
- `bun run convex:dev` (Convex local dev/watch)
