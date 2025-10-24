# Use pre-built SDK from base image
ARG BASE_IMAGE=frak-wallet-base:latest
FROM ${BASE_IMAGE} AS builder

# Set the working directory to the root of the monorepo
WORKDIR /app

# Fetch arg env
ARG STAGE
ENV NODE_ENV=production
ENV STAGE=$STAGE

# SDK is already built in the base image - just build the backend
RUN cd services/backend && bun run build

# Start a new stage for the final image
FROM oven/bun

WORKDIR /app

# Build in a compiled way
# COPY --from=builder /app/services/backend/server ./server

# Build in a bun ways
COPY --from=builder /app/services/backend/package.json .
COPY --from=builder /app/services/backend/dist ./dist

# Runtime port
EXPOSE 3030

ENV NODE_ENV=production
CMD ["bun", "run", "start"]
