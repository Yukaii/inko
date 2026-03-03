# Backend

Backend is split between:

- `apps/api` - Fastify HTTP API
- PostgreSQL - primary application database

Design docs:

- `docs/practice-queue-design.md` - queue-backed practice selection architecture, migration, and observability

Common commands:

- `docker compose up -d postgres`
- `bun run --filter @inko/api dev`
- `bun run db:migrate`
- `bun run --filter @inko/api test`
- `bun run --filter @inko/api lint`
- `bun run --filter @inko/api build`

Mail provider envs (`apps/api`):

- `MAIL_PROVIDER=log|resend`
- `MAIL_FROM=<from address>`
- `RESEND_API_KEY=<required when MAIL_PROVIDER=resend>`
- `MAGIC_LINK_LOGIN_URL=<optional override, defaults to ${FRONTEND_URL}/login>`

Database envs:

- `apps/api/.env`: `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/inko`
- optional: `DATABASE_POOL_MAX=10`

Local bootstrap:

- Start Postgres with `docker compose up -d postgres`
- Run `bun run db:migrate`
- Then start the API or run tests

Auth notes:

- The app now uses API-issued JWTs and email magic links only.
- Convex/OIDC verification and frontend Convex auth providers have been removed.
