# syntax=docker/dockerfile:1-labs
#
# Credential-sync — self-contained multi-stage build.
#
# This service has zero workspace dependencies on SDKs (only @libsql/client,
# drizzle-orm, mongodb) so it skips the Node 24 install + SDK build entirely
# and runs on alpine in the final image.

ARG BUN_VERSION=1.3.11

FROM oven/bun:${BUN_VERSION}-alpine AS deps
WORKDIR /app
COPY --link package.json bun.lock tsconfig.json ./
COPY --link --parents \
    apps/*/package.json \
    services/*/package.json \
    packages/*/package.json \
    sdk/*/package.json \
    example/*/package.json \
    ./
RUN --mount=type=cache,id=bun-store,target=/root/.bun/install/cache,sharing=locked \
    bun install --frozen-lockfile

FROM deps AS builder
COPY --link services/credential-sync ./services/credential-sync

ENV NODE_ENV=production

WORKDIR /app/services/credential-sync
RUN bun run build

FROM oven/bun:${BUN_VERSION}-alpine
WORKDIR /app

COPY --from=builder --chown=bun:bun /app/services/credential-sync/package.json ./
COPY --from=builder --chown=bun:bun /app/services/credential-sync/dist ./dist

USER bun

ENV NODE_ENV=production \
    BUN_RUNTIME_TRANSPILER_CACHE_PATH=0

CMD ["bun", "dist/index.js"]
