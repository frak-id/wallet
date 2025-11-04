# Build listener app using pre-built SDK from base image
ARG BASE_IMAGE=frak-wallet-base:latest
FROM ${BASE_IMAGE} AS builder

WORKDIR /app

# SDK is already built in the base image - just copy listener source files
COPY apps/listener/ ./apps/listener/

# Non-secret build args
ARG NODE_ENV
ARG STAGE
ARG BACKEND_URL
ARG INDEXER_URL
ARG ERPC_URL
ARG FRAK_WALLET_URL
ARG OPEN_PANEL_API_URL

ENV NODE_ENV=$NODE_ENV
ENV STAGE=$STAGE
ENV BACKEND_URL=$BACKEND_URL
ENV INDEXER_URL=$INDEXER_URL
ENV ERPC_URL=$ERPC_URL
ENV FRAK_WALLET_URL=$FRAK_WALLET_URL
ENV OPEN_PANEL_API_URL=$OPEN_PANEL_API_URL

# Build listener app with secrets mounted (not stored in layers)
WORKDIR /app/apps/listener
RUN --mount=type=secret,id=DRPC_API_KEY \
    --mount=type=secret,id=PIMLICO_API_KEY \
    --mount=type=secret,id=NEXUS_RPC_SECRET \
    --mount=type=secret,id=OPEN_PANEL_LISTENER_CLIENT_ID \
    export DRPC_API_KEY=$(cat /run/secrets/DRPC_API_KEY) && \
    export PIMLICO_API_KEY=$(cat /run/secrets/PIMLICO_API_KEY) && \
    export NEXUS_RPC_SECRET=$(cat /run/secrets/NEXUS_RPC_SECRET) && \
    export OPEN_PANEL_LISTENER_CLIENT_ID=$(cat /run/secrets/OPEN_PANEL_LISTENER_CLIENT_ID) && \
    bun run build

# Pre-compress all compressible static assets in builder stage
# This creates .gz files alongside originals (e.g., app.js + app.js.gz)
RUN find dist -type f \
    \( -name '*.js' -o -name '*.css' -o -name '*.html' -o -name '*.json' \
    -o -name '*.svg' -o -name '*.txt' -o -name '*.xml' -o -name '*.ico' \) \
    -exec gzip -9 -k {} \; && \
    echo "Pre-compressed $(find dist -name '*.gz' | wc -l) files"

# Final nginx image
FROM nginx:1.29.1

# Copy built static files (including pre-compressed .gz files) from builder
COPY --from=builder /app/apps/listener/dist /usr/share/nginx/html

# Copy nginx configuration
COPY apps/listener/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80
