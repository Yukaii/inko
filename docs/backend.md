# Backend

Backend is split between:

- `apps/api` - Fastify HTTP API
- PostgreSQL - primary application database

Design docs:

- `docs/practice-queue-design.md` - queue-backed practice selection architecture, migration, and observability

Common commands:

- `docker compose up -d garage`
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
- `API_PUBLIC_URL=http://localhost:4000`

Object storage envs:

- `OBJECT_STORAGE_ENDPOINT=http://127.0.0.1:3900`
- `OBJECT_STORAGE_REGION=garage`
- `OBJECT_STORAGE_BUCKET=inko-media`
- `OBJECT_STORAGE_ACCESS_KEY_ID=<garage key id>`
- `OBJECT_STORAGE_SECRET_ACCESS_KEY=<garage secret>`
- `OBJECT_STORAGE_FORCE_PATH_STYLE=true`

Production R2 env formats:

- `OBJECT_STORAGE_ENDPOINT`: `https://<accountid>.r2.cloudflarestorage.com`
- `OBJECT_STORAGE_REGION`: `auto`
- `OBJECT_STORAGE_ACCESS_KEY_ID`: R2 API token access key ID
- `OBJECT_STORAGE_SECRET_ACCESS_KEY`: R2 API token secret access key
- `OBJECT_STORAGE_BUCKET`: existing R2 bucket name

Local bootstrap:

- Use your existing local PostgreSQL instance
- Optional: start Garage with `docker compose up -d garage` for local S3-compatible testing
- Garage bootstraps the single local node, `inko-media` bucket, and `inko-app` key automatically
- Use these local compose credentials in `apps/api/.env`:
  - `OBJECT_STORAGE_ACCESS_KEY_ID=GKb599967dd3416890fee1b9bf`
  - `OBJECT_STORAGE_SECRET_ACCESS_KEY=68af3881281301775c8a62b05c2cd30e40d7572bb8fa33b0c8945538a60c658d`
- Run `bun run db:migrate`
- Then start the API or run tests

Auth notes:

- The app now uses API-issued JWTs and email magic links only.
- Magic-link tokens are stored in PostgreSQL.
- Legacy OIDC verification and older frontend auth providers have been removed.
- Optional OAuth providers are now first-party API flows:
  - `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`
  - `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
  - frontend button gates remain `VITE_AUTH_GITHUB_ENABLED=true` and `VITE_AUTH_GOOGLE_ENABLED=true`
- OAuth completion now uses a short-lived HTTP-only cookie handoff instead of putting the JWT in the redirect URL.
