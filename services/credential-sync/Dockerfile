ARG BASE_IMAGE=frak-wallet-base:latest
FROM ${BASE_IMAGE} AS builder

WORKDIR /app

ENV NODE_ENV=production

RUN bun install --frozen-lockfile

COPY services/credential-sync ./services/credential-sync

RUN cd services/credential-sync && bun run build

FROM oven/bun:1.3.11

WORKDIR /app

COPY --from=builder --chown=bun:bun /app/services/credential-sync/package.json .
COPY --from=builder --chown=bun:bun /app/services/credential-sync/dist ./dist

USER bun

ENV NODE_ENV=production
ENV BUN_RUNTIME_TRANSPILER_CACHE_PATH=0

CMD ["bun", "dist/index.js"]
