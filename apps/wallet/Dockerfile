# Build wallet app
FROM oven/bun:1.3.0 AS builder

WORKDIR /app

# Copy root package files
COPY package.json bun.lock tsconfig.json ./

# Copy all workspace packages that wallet depends on
COPY packages/ ./packages/
COPY services/ ./services/
COPY sdk/ ./sdk/
COPY .stubs/ .stubs/

# Copy app package.json files (for workspace resolution)
COPY apps/wallet/package.json ./apps/wallet/
COPY apps/listener/package.json ./apps/listener/

# Install dependencies
RUN bun install

# Build SDK packages (required for wallet build)
# Note: Declaration generation may fail but JS builds succeed - continue anyway
RUN (bun run --cwd packages/rpc build || true) && \
    (bun run --cwd sdk/core build || true) && \
    (bun run --cwd sdk/legacy build || true) && \
    (bun run --cwd sdk/react build || true) && \
    (bun run --cwd sdk/components build || true) && \
    echo "SDK builds completed (some may have partial failures)"

    # Need to figure out why we can't just rely on build:sdk
# RUN bun run build:sdk

# Copy wallet source files
COPY apps/wallet/ ./apps/wallet/

# Build wallet app (builds service worker + React Router)
WORKDIR /app/apps/wallet
# SSR build may fail with Bun but client build succeeds - that's what we need
RUN bun run build || (test -d build/client && echo "Client build succeeded, SSR failed but not needed") && \
    rm -rf build/server

# Final nginx image
FROM nginx:1.29.1

# Copy built static files from React Router build output
COPY --from=builder /app/apps/wallet/build/client /usr/share/nginx/html

# Copy nginx configuration
COPY apps/wallet/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80
