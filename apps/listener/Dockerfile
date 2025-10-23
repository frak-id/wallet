# Build listener app
FROM oven/bun:1.3.0 AS builder

WORKDIR /app

# Copy root package files
COPY package.json bun.lock tsconfig.json ./

# Copy all workspace packages that listener depends on
COPY packages/ ./packages/
COPY services/ ./services/
COPY sdk/ ./sdk/
COPY .stubs/ .stubs/

# Copy app package.json files (for workspace resolution)
COPY apps/listener/package.json ./apps/listener/
COPY apps/wallet/package.json ./apps/wallet/

# Install dependencies
RUN bun install

# Build SDK packages (required for listener build)
RUN bun run build:sdk

# Copy listener source files
COPY apps/listener/ ./apps/listener/

# Build listener app (Vite build)
WORKDIR /app/apps/listener
RUN bun run build

# Final nginx image
FROM nginx:1.29.1

# Copy built static files from Vite build output
COPY --from=builder /app/apps/listener/dist /usr/share/nginx/html

# Copy nginx configuration
COPY apps/listener/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80
