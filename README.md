# Inkō

Inkō is a vocabulary learning app built around active recall across multiple channels: writing, typing, and listening. The goal is to help learners move beyond recognition and build durable recall for languages that rely on non-Latin scripts, especially Japanese, Chinese, and Korean.

## What Users Can Do

- Create and manage vocabulary decks
- Start with seeded starter content
- Practice from the dashboard into guided review flows
- Train production rather than passive recognition
- Use local magic-link auth, or enable social sign-in when configured

For the product direction and learning model, see [docs/prd.md](/Users/yukai/Projects/Personal/inko/docs/prd.md).

## App Routes

- `/login`
- `/dashboard`
- `/word-bank`
- `/practice/:deckId`
- `/settings`

## Quick Start

1. Install dependencies:

```bash
bun install
```

2. Copy local environment files:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

3. Start Convex local development:

```bash
bun run convex:dev
```

The first run is interactive and writes local deployment config. For local-first development, choose the local dev deployment when prompted.

4. Start the app:

```bash
bun run dev
```

5. Optionally seed starter data:

```bash
bun run seed:starter
```

## Local Auth

- With `MAIL_PROVIDER=log`, the login token is returned locally for development and can be pasted into the login form.
- With `MAIL_PROVIDER=resend`, magic links are sent by email.
- Google, GitHub, and Apple sign-in are supported when their provider credentials and frontend flags are configured.

## Documentation

The `README` is intentionally product- and usage-focused. Technical and implementation details live in the docs:

- [docs/architecture.md](/Users/yukai/Projects/Personal/inko/docs/architecture.md): monorepo shape and request flow
- [docs/frontend.md](/Users/yukai/Projects/Personal/inko/docs/frontend.md): web app structure and frontend commands
- [docs/backend.md](/Users/yukai/Projects/Personal/inko/docs/backend.md): API, Convex, auth, and backend env details
- [docs/deployment.md](/Users/yukai/Projects/Personal/inko/docs/deployment.md): production deployment setup
- [docs/prd.md](/Users/yukai/Projects/Personal/inko/docs/prd.md): product requirements and UX intent
- [docs/practice-queue-design.md](/Users/yukai/Projects/Personal/inko/docs/practice-queue-design.md): practice queue architecture

## Common Commands

- `bun run dev`
- `bun run test`
- `bun run lint`
- `bun run build`
