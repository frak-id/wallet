# syntax=docker/dockerfile:1-labs
#
# Listener iframe app — self-contained multi-stage build. See apps/wallet/Dockerfile
# for the full caching-strategy commentary.

ARG BUN_VERSION=1.4.4
# Image whose assets the new image also serves; the default (the base image) carries none.
ARG PREVIOUS_IMAGE=nginx:1.31.8-alpine

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

RUN (cd dist && find assets -type f | sort) > /app/release-assets.txt \
    && echo "Release assets: $(wc -l < /app/release-assets.txt) files"

# A document cached from the previous release still imports that release's hashed chunks.
# Rebuilding the same release carries what the image it replaces carried, so a redeploy keeps the window.
# Images built before release-assets.txt existed carry everything under assets/.
FROM ${PREVIOUS_IMAGE} AS previous
COPY --from=app-builder /app/release-assets.txt /tmp/own-assets.txt
RUN set -eu; \
    mkdir /carry; \
    cd /usr/share/nginx/html; \
    : > /tmp/carried; \
    if [ -f /usr/share/nginx/release-assets.txt ]; then \
        if cmp -s /usr/share/nginx/release-assets.txt /tmp/own-assets.txt; then \
            if [ -f /usr/share/nginx/previous-assets.txt ]; then cp /usr/share/nginx/previous-assets.txt /tmp/carried; fi; \
        else \
            cp /usr/share/nginx/release-assets.txt /tmp/carried; \
        fi; \
    elif [ -d assets ]; then \
        find assets -type f > /tmp/carried; \
    fi; \
    LC_ALL=C sort -u /tmp/carried > /previous-assets.txt; \
    if [ -s /previous-assets.txt ]; then \
        tar -cf - -T /previous-assets.txt | tar -xf - -C /carry; \
    fi; \
    echo "Carrying $(wc -l < /previous-assets.txt) files from the previous release"

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
COPY --from=previous /carry/ /usr/share/nginx/html/
COPY --from=previous /previous-assets.txt /usr/share/nginx/previous-assets.txt
COPY --from=app-builder /app/apps/listener/dist /usr/share/nginx/html
COPY --from=app-builder /app/release-assets.txt /usr/share/nginx/release-assets.txt
COPY apps/listener/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/listener/security-headers.conf /etc/nginx/snippets/security-headers.conf
EXPOSE 80
