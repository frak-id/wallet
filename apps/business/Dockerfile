# Build business app using pre-built SDK from base image
ARG BASE_IMAGE=frak-wallet-base:latest
FROM ${BASE_IMAGE} AS builder

WORKDIR /app

# Install dependencies (SDK already built in base image)
RUN bun install --frozen-lockfile

# Copy required packages
COPY packages/ ./packages/

# Copy business app source files
COPY apps/business ./apps/business

# Non-secret build args
ARG NODE_ENV
ARG STAGE
ARG FRAK_WALLET_URL
ARG BACKEND_URL
ARG ERPC_URL
ARG OPEN_PANEL_API_URL

ENV NODE_ENV=$NODE_ENV
ENV STAGE=$STAGE
ENV FRAK_WALLET_URL=$FRAK_WALLET_URL
ENV BACKEND_URL=$BACKEND_URL
ENV ERPC_URL=$ERPC_URL
ENV OPEN_PANEL_API_URL=$OPEN_PANEL_API_URL

# Build business app with secrets mounted (not stored in layers)
WORKDIR /app/apps/business
RUN --mount=type=secret,id=OPEN_PANEL_BUSINESS_CLIENT_ID \
    --mount=type=secret,id=DRPC_API_KEY \
    --mount=type=secret,id=NEXUS_RPC_SECRET \
    --mount=type=secret,id=FUNDING_ON_RAMP_URL \
    export OPEN_PANEL_BUSINESS_CLIENT_ID=$(cat /run/secrets/OPEN_PANEL_BUSINESS_CLIENT_ID) && \
    export DRPC_API_KEY=$(cat /run/secrets/DRPC_API_KEY) && \
    export NEXUS_RPC_SECRET=$(cat /run/secrets/NEXUS_RPC_SECRET) && \
    export FUNDING_ON_RAMP_URL=$(cat /run/secrets/FUNDING_ON_RAMP_URL) && \
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
COPY --from=builder /app/apps/business/dist /usr/share/nginx/html

# Copy nginx configuration
COPY apps/business/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80
