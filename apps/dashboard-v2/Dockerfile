# Use pre-built SDK from base image
ARG BASE_IMAGE=frak-wallet-base:latest
FROM ${BASE_IMAGE} AS builder

# Set the working directory to the root of the monorepo
WORKDIR /app

# Fetch arg env
ARG STAGE
ENV NODE_ENV=production
ENV STAGE=$STAGE

# SDK is already built in the base image - just build the dashboard
RUN cd apps/dashboard-v2 && bun run build

# Start a new stage for the final image
FROM oven/bun

WORKDIR /app

# Copy the bundled stuff
COPY --from=builder /app/apps/dashboard-v2/package.json .
COPY --from=builder /app/apps/dashboard-v2/.output ./.output

# Runtime port
EXPOSE 3022

ENV NODE_ENV=production
CMD ["bun", "run", "start:prod"]
