# syntax=docker/dockerfile:1-labs
#
# Shopify bootstrap orchestrator — one-shot K8s Job that runs BEFORE the Shopify
# Service rolls out (the Service declares `dependsOn` this Job).
#
# Steps: Drizzle schema migrations + one-time data copy from the legacy public
# Postgres to the in-cluster GCP Postgres. Bundled to a single dist/index.js via
# Bun (same approach as services/bootstrap).
#
# The `drizzle/` SQL files are sourced from apps/shopify (the app owns the schema
# + migration history) and must be present at runtime — drizzle-orm's migrator
# reads `.sql` files from disk (`./drizzle/{dev,prod}` relative to cwd).

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
COPY --link services/shopify-bootstrap ./services/shopify-bootstrap

ENV NODE_ENV=production

WORKDIR /app/services/shopify-bootstrap
RUN bun run build

FROM oven/bun:${BUN_VERSION}-alpine
WORKDIR /app/services/shopify-bootstrap

COPY --from=builder --chown=bun:bun /app/services/shopify-bootstrap/package.json ./
COPY --from=builder --chown=bun:bun /app/services/shopify-bootstrap/dist ./dist
# Migration SQL is owned by the app — ship the dev + prod histories.
COPY --link --chown=bun:bun apps/shopify/drizzle ./drizzle

USER bun

ENV NODE_ENV=production

CMD ["bun", "dist/index.js"]
