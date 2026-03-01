# Backend

Backend is split between:

- `apps/api` - Fastify HTTP API
- `convex` - data schema + queries/mutations/actions

Design docs:

- `docs/practice-queue-design.md` - queue-backed practice selection architecture, migration, and observability

Common commands:

- `bun run --filter @inko/api dev`
- `bun run --filter @inko/api test`
- `bun run --filter @inko/api lint`
- `bun run --filter @inko/api build`
- `bun run convex:dev` (Convex local dev/watch)

Mail provider envs (`apps/api`):

- `MAIL_PROVIDER=log|resend`
- `MAIL_FROM=<from address>`
- `RESEND_API_KEY=<required when MAIL_PROVIDER=resend>`
- `MAGIC_LINK_LOGIN_URL=<optional override, defaults to ${FRONTEND_URL}/login>`

OAuth-related envs:

- `apps/api/.env`: `CONVEX_SITE_URL=<Convex site origin used for OIDC token verification>`
- repo/root `.env.local` for Convex Auth: `SITE_URL`, `JWT_PRIVATE_KEY`
- optional social providers in repo/root `.env.local`: `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_APPLE_ID`, `AUTH_APPLE_SECRET`
- `apps/web/.env.local`: `VITE_AUTH_GOOGLE_ENABLED=true`, `VITE_AUTH_GITHUB_ENABLED=true`, `VITE_AUTH_APPLE_ENABLED=true`

Provider visibility:

- The login page only renders a provider button when the corresponding `VITE_AUTH_*_ENABLED` flag is exactly `true`.
- Treat these as UI gates; they do not configure the provider by themselves.
