FROM node:24-slim AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN pnpm install --frozen-lockfile

COPY apps/api ./apps/api
COPY packages/shared ./packages/shared

RUN pnpm run --filter @inko/shared build \
  && pnpm run --filter @inko/api build

FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/tsconfig.base.json ./tsconfig.base.json

EXPOSE 4000

CMD ["node", "apps/api/dist/apps/api/src/server.js"]
