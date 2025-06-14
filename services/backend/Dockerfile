# Use a multi-stage build
FROM --platform=$BUILDPLATFORM node:lts AS builder

# Set the working directory to the root of the monorepo
WORKDIR /monorepo

# Copy the entire monorepo
COPY . .

# Setup bun (since we are on a node image)
RUN npm i -g bun

# Fetch arg env
ARG STAGE
ENV NODE_ENV=production
ENV STAGE=$STAGE

# Install dependencies and build the project
RUN bun install --frozen-lockfile
RUN bun run build:sdk
RUN cd services/backend && bun run build

# Start a new stage for the final image
FROM oven/bun

WORKDIR /app

# Build in a compiled way
# COPY --from=builder /monorepo/services/backend/server ./server

# Build in a bun ways
COPY --from=builder /monorepo/services/backend/package.json .
COPY --from=builder /monorepo/services/backend/dist ./dist

# Runtime port
EXPOSE 3030

ENV NODE_ENV=production
CMD ["bun", "run", "start"]
