# Use pre-built SDK from base image
ARG BASE_IMAGE=frak-wallet-base:latest
FROM ${BASE_IMAGE} AS builder

# Set the working directory to the root of the monorepo
WORKDIR /app

# Non-secret build args
ARG NODE_ENV
ARG STAGE
ARG FRAK_WALLET_URL
ARG BACKEND_URL
ARG INDEXER_URL
ARG ERPC_URL
ARG OPEN_PANEL_API_URL

ENV NODE_ENV=$NODE_ENV
ENV STAGE=$STAGE
ENV FRAK_WALLET_URL=$FRAK_WALLET_URL
ENV BACKEND_URL=$BACKEND_URL
ENV INDEXER_URL=$INDEXER_URL
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

# Start a new stage for the final image
FROM oven/bun

WORKDIR /app

# Copy the bundled stuff
COPY --from=builder /app/apps/business/package.json .
COPY --from=builder /app/apps/business/.output ./.output

# Runtime port
EXPOSE 3022

ENV NODE_ENV=production
CMD ["bun", "run", "start:prod"]
