# syntax=docker/dockerfile:1-labs
#
# Listener iframe app — self-contained multi-stage build. See apps/wallet/Dockerfile
# for the full caching-strategy commentary.

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
COPY --link apps/listener ./apps/listener

ARG NODE_ENV
ARG STAGE
ARG BACKEND_URL
ARG ERPC_URL
ARG FRAK_WALLET_URL
ARG OPEN_PANEL_API_URL

ENV NODE_ENV=$NODE_ENV \
    STAGE=$STAGE \
    BACKEND_URL=$BACKEND_URL \
    ERPC_URL=$ERPC_URL \
    FRAK_WALLET_URL=$FRAK_WALLET_URL \
    OPEN_PANEL_API_URL=$OPEN_PANEL_API_URL

WORKDIR /app/apps/listener
RUN --mount=type=secret,id=DRPC_API_KEY \
    --mount=type=secret,id=PIMLICO_API_KEY \
    --mount=type=secret,id=NEXUS_RPC_SECRET \
    --mount=type=secret,id=OPEN_PANEL_LISTENER_CLIENT_ID \
    --mount=type=secret,id=ANDROID_SHA256_FINGERPRINT \
    export DRPC_API_KEY=$(cat /run/secrets/DRPC_API_KEY) && \
    export PIMLICO_API_KEY=$(cat /run/secrets/PIMLICO_API_KEY) && \
    export NEXUS_RPC_SECRET=$(cat /run/secrets/NEXUS_RPC_SECRET) && \
    export OPEN_PANEL_LISTENER_CLIENT_ID=$(cat /run/secrets/OPEN_PANEL_LISTENER_CLIENT_ID) && \
    export ANDROID_SHA256_FINGERPRINT=$(cat /run/secrets/ANDROID_SHA256_FINGERPRINT) && \
    bun run build

RUN find dist -type f \
    \( -name '*.js' -o -name '*.css' -o -name '*.html' -o -name '*.json' \
       -o -name '*.svg' -o -name '*.txt' -o -name '*.xml' -o -name '*.ico' \) \
    -print0 \
    | xargs -0 -P "$(nproc)" -n 32 gzip -9 -k && \
    echo "Pre-compressed $(find dist -name '*.gz' | wc -l) files"

FROM nginx:1.29.1-alpine
COPY --from=app-builder /app/apps/listener/dist /usr/share/nginx/html
COPY apps/listener/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
