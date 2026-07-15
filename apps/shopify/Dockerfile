# syntax=docker/dockerfile:1-labs
#
# Shopify embedded app — self-contained multi-stage build.
#
# Unlike apps/business (a static SPA served by nginx), this is a React Router v7
# SSR app: it ships a long-lived Node/Bun HTTP server (`react-router-serve`),
# exactly like services/backend. The builder stages are intentionally identical
# to business/backend so the tooling/deps/sdk-builder layers dedupe at the blob
# level inside the in-cluster zot cache.
#
# Env split (important):
#   - PUBLIC, non-secret vars are baked at BUILD time via Vite `define`
#     (see apps/shopify/vite.config.ts) and are passed here as build ARGs.
#   - SECRETS (DB password/host, API secret, salts) are read from `process.env`
#     at RUNTIME in server code and are injected by Kubernetes via `envFrom`
#     a Secret — they are NOT baked into the image.

ARG BUN_VERSION=1.3.11

FROM oven/bun:${BUN_VERSION} AS tooling
# Node 24 is required for the SDK build step (vanilla-extract VM-sandbox quirks).
RUN --mount=type=cache,id=apt-cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,id=apt-lib,target=/var/lib/apt,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean \
    && apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y --no-install-recommends nodejs

FROM tooling AS deps
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

FROM deps AS sdk-builder
COPY --link sdk ./sdk
COPY --link packages/rpc ./packages/rpc
COPY --link packages/dev-tooling ./packages/dev-tooling
COPY --link packages/design-system ./packages/design-system
RUN bun run build:sdk

FROM sdk-builder AS app-builder
COPY --link packages ./packages
# services/backend is only referenced via `import type` (Eden treaty types), so it
# is erased from the build output. Copied here purely so the workspace symlink in
# node_modules resolves cleanly during the Vite build.
COPY --link services/backend ./services/backend
COPY --link apps/shopify ./apps/shopify

# Public, non-secret build args — these get inlined into the JS bundle by Vite
# `define`. Mirror the keys defined in apps/shopify/vite.config.ts.
ARG NODE_ENV=production
ARG STAGE
ARG FRAK_WALLET_URL
ARG FRAK_COMPONENTS_URL
ARG BUSINESS_URL
ARG BACKEND_URL
ARG SHOPIFY_API_KEY
ARG SHOPIFY_APP_URL

ENV NODE_ENV=$NODE_ENV \
    STAGE=$STAGE \
    FRAK_WALLET_URL=$FRAK_WALLET_URL \
    FRAK_COMPONENTS_URL=$FRAK_COMPONENTS_URL \
    BUSINESS_URL=$BUSINESS_URL \
    BACKEND_URL=$BACKEND_URL \
    SHOPIFY_API_KEY=$SHOPIFY_API_KEY \
    SHOPIFY_APP_URL=$SHOPIFY_APP_URL

WORKDIR /app/apps/shopify
RUN bun run build

# ---- Runtime -------------------------------------------------------------
# The React Router server build (build/server/index.js) is NOT bundled — it still
# imports from node_modules and from the workspace packages at runtime. So we ship
# the hoisted root node_modules plus the symlink targets (sdk/*, packages/*) and
# the built app. services/backend is intentionally excluded (type-only at build).
FROM oven/bun:${BUN_VERSION}
WORKDIR /app

COPY --from=app-builder --chown=bun:bun /app/package.json /app/bun.lock ./
COPY --from=app-builder --chown=bun:bun /app/node_modules ./node_modules
COPY --from=app-builder --chown=bun:bun /app/sdk ./sdk
COPY --from=app-builder --chown=bun:bun /app/packages ./packages
COPY --from=app-builder --chown=bun:bun /app/apps/shopify ./apps/shopify

USER bun
WORKDIR /app/apps/shopify

ENV NODE_ENV=production \
    PORT=3000 \
    BUN_RUNTIME_TRANSPILER_CACHE_PATH=0

EXPOSE 3000

# `bun run start` -> `react-router-serve ./build/server/index.js`
# Bun is PID 1 and receives SIGTERM cleanly for graceful shutdown.
CMD ["bun", "run", "start"]
