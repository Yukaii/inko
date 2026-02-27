FROM oven/bun:1 AS builder
WORKDIR /app

COPY package.json bun.lock tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN bun install --frozen-lockfile

COPY apps/api ./apps/api
COPY packages/shared ./packages/shared

RUN bun run --filter @inko/shared build \
  && bun run --filter @inko/api build

FROM oven/bun:1-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/tsconfig.base.json ./tsconfig.base.json

EXPOSE 4000

CMD ["bun", "apps/api/dist/apps/api/src/server.js"]
