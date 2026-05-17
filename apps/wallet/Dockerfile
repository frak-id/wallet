# syntax=docker/dockerfile:1.10
#
# Wallet app — self-contained multi-stage build.
#
# Caching strategy (in-cluster zot via cacheFrom/cacheTo, applied by infra/gcp/utils.ts):
#   - Stage `tooling`        : Bun + Node 24 install. Identical content hash across all
#                              SDK-consuming Dockerfiles, so the underlying blobs are
#                              deduped in zot regardless of which image first pushed them.
#   - Stage `deps`           : Workspace package.jsons + frozen-lockfile install. Cache
#                              mount `id=bun-store` is shared across every image in this
#                              repo, so a touched package.json only redownloads diffs.
#   - Stage `sdk-builder`    : Builds SDK packages. ~30s cold; layer is reused as long as
#                              SDK source is unchanged.
#   - Stage `app-builder`    : App source + Vite build. Invalidated only by app/package
#                              source changes.
#   - Final stage            : nginx:alpine with pre-compressed static assets.
#
# Node 24 is required by tsdown/@vanilla-extract/integration during the SDK build:
# vanilla-extract's `compile()` relies on `vm.Script` + `Module._load` via the `eval`
# package, which Bun's Node compat layer cannot satisfy from a VM sandbox.

ARG BUN_VERSION=1.3.11

FROM oven/bun:${BUN_VERSION} AS tooling
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
# `--parents` (Dockerfile 1.7+) preserves directory structure so every workspace
# package.json lands at its canonical path without 22 separate COPY statements.
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
COPY --link packages/ui ./packages/ui
COPY --link packages/design-system ./packages/design-system
RUN bun run build:sdk

FROM sdk-builder AS app-builder
COPY --link packages ./packages
COPY --link apps/wallet ./apps/wallet

ARG NODE_ENV
ARG STAGE
ARG BACKEND_URL
ARG ERPC_URL
ARG FRAK_WALLET_URL
ARG OPEN_PANEL_API_URL
ARG IS_APP_AVAILABLE
ARG MONERIUM_CLIENT_ID

ENV NODE_ENV=$NODE_ENV \
    STAGE=$STAGE \
    BACKEND_URL=$BACKEND_URL \
    ERPC_URL=$ERPC_URL \
    FRAK_WALLET_URL=$FRAK_WALLET_URL \
    OPEN_PANEL_API_URL=$OPEN_PANEL_API_URL \
    IS_APP_AVAILABLE=$IS_APP_AVAILABLE \
    MONERIUM_CLIENT_ID=$MONERIUM_CLIENT_ID

WORKDIR /app/apps/wallet
RUN --mount=type=secret,id=DRPC_API_KEY \
    --mount=type=secret,id=PIMLICO_API_KEY \
    --mount=type=secret,id=NEXUS_RPC_SECRET \
    --mount=type=secret,id=VAPID_PUBLIC_KEY \
    --mount=type=secret,id=OPEN_PANEL_WALLET_CLIENT_ID \
    --mount=type=secret,id=ANDROID_SHA256_FINGERPRINT \
    --mount=type=secret,id=MONERIUM_CLIENT_ID \
    export DRPC_API_KEY=$(cat /run/secrets/DRPC_API_KEY) && \
    export PIMLICO_API_KEY=$(cat /run/secrets/PIMLICO_API_KEY) && \
    export NEXUS_RPC_SECRET=$(cat /run/secrets/NEXUS_RPC_SECRET) && \
    export VAPID_PUBLIC_KEY=$(cat /run/secrets/VAPID_PUBLIC_KEY) && \
    export OPEN_PANEL_WALLET_CLIENT_ID=$(cat /run/secrets/OPEN_PANEL_WALLET_CLIENT_ID) && \
    export ANDROID_SHA256_FINGERPRINT=$(cat /run/secrets/ANDROID_SHA256_FINGERPRINT) && \
    export MONERIUM_CLIENT_ID=$(cat /run/secrets/MONERIUM_CLIENT_ID) && \
    bun run build

# Parallel gzip pre-compression — one process per CPU instead of serial -exec.
RUN find dist -type f \
    \( -name '*.js' -o -name '*.css' -o -name '*.html' -o -name '*.json' \
       -o -name '*.svg' -o -name '*.txt' -o -name '*.xml' -o -name '*.ico' \) \
    -print0 \
    | xargs -0 -P "$(nproc)" -n 32 gzip -9 -k && \
    echo "Pre-compressed $(find dist -name '*.gz' | wc -l) files"

FROM nginx:1.29.1-alpine
COPY --from=app-builder /app/apps/wallet/dist /usr/share/nginx/html
# nginx envsubst on /etc/nginx/templates/*.template at container startup; the
# NGINX_ENVSUBST_FILTER scopes substitution to MONERIUM_* env vars so nginx's
# own $uri/$http_* are left untouched. MONERIUM_API_HOST is set per-stage on
# the pod via Pulumi.
COPY apps/wallet/nginx.conf /etc/nginx/templates/default.conf.template
ENV NGINX_ENVSUBST_FILTER='^MONERIUM_'
EXPOSE 80
