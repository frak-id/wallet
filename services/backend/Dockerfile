# Use pre-built SDK from base image
ARG BASE_IMAGE=frak-wallet-base:latest
FROM ${BASE_IMAGE} AS builder

# Set the working directory to the root of the monorepo
WORKDIR /app

# Fetch arg env
ARG STAGE
ENV NODE_ENV=production
ENV STAGE=$STAGE

# Install dependencies (SDK already built in base image)
RUN bun install --frozen-lockfile

# Copy required packages
COPY packages/ ./packages/

# Copy backend service
COPY services/backend ./services/backend

# Build the backend
RUN cd services/backend && bun run build

# Start a new stage for the final image
FROM oven/bun:1.3.11

WORKDIR /app

# Security: run as non-root user (bun user ships with the official image)
COPY --from=builder --chown=bun:bun /app/services/backend/package.json .
COPY --from=builder --chown=bun:bun /app/services/backend/dist ./dist

# Sharp is a native module (libvips bindings) — can't be bundled, install directly in runtime
RUN cd /tmp && bun add sharp && cp -rL node_modules /app/node_modules && rm -rf /tmp/node_modules /tmp/package.json /tmp/bun.lock

USER bun

# Runtime port
EXPOSE 3030

ENV NODE_ENV=production
# Disable transpiler cache in ephemeral containers (official recommendation)
ENV BUN_RUNTIME_TRANSPILER_CACHE_PATH=0

# Direct entrypoint — Bun is PID 1, receives SIGTERM cleanly
# --smol: enables JSC's stopIfNecessaryTimer for aggressive GC in constrained containers
CMD ["bun", "--smol", "dist/index.js"]
