# syntax=docker/dockerfile:1-labs
#
# Listener iframe app — self-contained multi-stage build. See apps/wallet/Dockerfile
# for the full caching-strategy commentary.

ARG BUN_VERSION=1.4.4

FROM oven/bun:${BUN_VERSION} AS tooling
RUN --mount=type=cache,id=apt-cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,id=apt-lib,target=/var/lib/apt,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean \
    && apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl gnupg brotli \
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
    | xargs -0 -P "$(nproc)" -n 32 sh -c 'gzip -9 -k "$@" && brotli -q 11 "$@"' _ && \
    echo "Pre-compressed $(find dist \( -name '*.gz' -o -name '*.br' \) | wc -l) files (gzip + brotli)"

FROM nginx:1.31.8-alpine
# The module signature encodes PCRE, so pcre2-dev stays; gzip is dropped so zlib is not needed.
RUN set -eux; \
    apk add --no-cache --virtual .brotli-build build-base pcre2-dev; \
    cd /tmp; \
    wget -qO nginx.tar.gz "https://nginx.org/download/nginx-${NGINX_VERSION}.tar.gz"; \
    wget -qO ngx_brotli.tar.gz https://codeload.github.com/google/ngx_brotli/tar.gz/53e0fb55f250f48fe80c0ddbf6c0f7103cdbaae1; \
    echo "27a4352dae4ba4922f9f013f3f0d02359aceeef2701872efa42849c3ba05457a  ngx_brotli.tar.gz" | sha256sum -c -; \
    mkdir nginx ngx_brotli; \
    tar -xzf nginx.tar.gz -C nginx --strip-components=1; \
    tar -xzf ngx_brotli.tar.gz -C ngx_brotli --strip-components=1; \
    cd nginx; \
    ./configure --with-compat --without-http_gzip_module --add-dynamic-module=../ngx_brotli/static; \
    make modules; \
    cp objs/ngx_http_brotli_static_module.so /usr/lib/nginx/modules/; \
    sed -i '1i load_module modules/ngx_http_brotli_static_module.so;' /etc/nginx/nginx.conf; \
    cd /; rm -rf /tmp/*; \
    apk del --no-cache .brotli-build
COPY --from=app-builder /app/apps/listener/dist /usr/share/nginx/html
COPY apps/listener/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/listener/security-headers.conf /etc/nginx/snippets/security-headers.conf
EXPOSE 80
