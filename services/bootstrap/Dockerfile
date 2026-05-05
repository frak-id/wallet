ARG BASE_IMAGE=frak-wallet-base:latest
FROM ${BASE_IMAGE} AS builder

WORKDIR /app

ENV NODE_ENV=production

RUN bun install --frozen-lockfile

COPY services/bootstrap ./services/bootstrap

FROM oven/bun:1.3.11

WORKDIR /app

COPY --from=builder --chown=bun:bun /app/node_modules ./node_modules
COPY --from=builder --chown=bun:bun /app/services/bootstrap ./services/bootstrap

USER bun

WORKDIR /app/services/bootstrap

ENV NODE_ENV=production

CMD ["bun", "run", "src/index.ts"]
