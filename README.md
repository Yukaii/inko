# Inkō MVP

Monorepo for the Inkō web MVP.

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

- Request magic link token from login page.
- API logs the token in terminal.
- Paste token in login form to verify.

## Implemented Routes

- `/login`
- `/dashboard`
- `/word-bank`
- `/practice/:deckId`
- `/settings`
