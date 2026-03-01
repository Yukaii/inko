# Inkō

Monorepo for the Inkō web app.

## Stack

- `apps/web`: Vite + React + TypeScript
- `apps/api`: Fastify + TypeScript
- `convex/`: Convex schema and functions
- `packages/shared`: shared zod schemas + scoring/scheduling logic

## Quick Start

1. Install deps:

```bash
bun install
```

2. Initialize Convex for this repo (first time only):

```bash
bun run convex:dev
```

This command is interactive the first time and writes local deployment config.
If prompted, choose:
- existing or new project (either works)
- `dev deployment: local` for local-first development

3. Start Convex in watch mode:

```bash
bun run convex:dev
```

4. Configure env files:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

5. Start API and web:

```bash
bun run dev
```

## Seed Starter Data

After Convex is initialized and running, seed a default Japanese deck and starter words:

```bash
bun run seed:starter
```

To seed another email:

```bash
bunx convex run seed:seedStarterData '{"email":"you@example.com"}'
```

## Auth Flow (Local)

- Request magic link from login page.
- With `MAIL_PROVIDER=log` (default), token is returned for local/dev and can be pasted in login form.
- With `MAIL_PROVIDER=resend`, magic link is sent via email and login page can auto-verify from `?token=...`.
- OAuth sign-in is supported through Convex Auth for Google, GitHub, and Apple once the provider env vars are configured.

## OAuth Provider Setup

Convex Auth uses the Convex HTTP auth routes under your Convex site URL. Register these callback URLs with each provider:

- Local: `http://127.0.0.1:3211/api/auth/callback/<provider>`
- Production: `https://<your-convex-site>/api/auth/callback/<provider>`

Environment variables:

- repo/root `.env.local` for Convex Auth: `SITE_URL`, `JWT_PRIVATE_KEY`
- optional social providers in repo/root `.env.local`: `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_APPLE_ID`, `AUTH_APPLE_SECRET`
- `apps/api/.env`: `CONVEX_SITE_URL`
- `apps/web/.env.local`: `VITE_CONVEX_URL`
- `apps/web/.env.local`: `VITE_AUTH_GOOGLE_ENABLED=true`, `VITE_AUTH_GITHUB_ENABLED=true`, `VITE_AUTH_APPLE_ENABLED=true`

Frontend visibility rule:

- A provider button is shown on the login page only when its `VITE_AUTH_*_ENABLED` flag is set to `true`.
- Keep the flag unset or set it to anything else to hide that provider from the UI.
- These flags should match the backend/provider configuration so users never see a provider that is not actually available.

## Implemented Routes

- `/login`
- `/dashboard`
- `/word-bank`
- `/practice/:deckId`
- `/settings`

## Production Deployment

Deployment setup and production prep are documented in:

- `docs/deployment.md`
