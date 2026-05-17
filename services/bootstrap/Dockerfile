# syntax=docker/dockerfile:1-labs
#
# Bootstrap orchestrator — runs Postgres + libSQL Drizzle migrations and RustFS
# bucket provisioning as a one-shot K8s Job before backend rollout.
#
# Bundled into a single `dist/index.js` via Bun's bundler (same approach as
# services/credential-sync); the runtime image ships just dist/ + drizzle/ SQL
# files on alpine, no node_modules. The `drizzle/` directory must be present at
# runtime because drizzle-orm's migrator reads `.sql` files from disk
# (`./drizzle/{prod,dev,v2,local,libsql}` paths resolved relative to cwd).

ARG BUN_VERSION=1.3.11

FROM oven/bun:${BUN_VERSION}-alpine AS deps
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

FROM deps AS builder
COPY --link services/bootstrap ./services/bootstrap

ENV NODE_ENV=production

WORKDIR /app/services/bootstrap
RUN bun run build

FROM oven/bun:${BUN_VERSION}-alpine
WORKDIR /app/services/bootstrap

COPY --from=builder --chown=bun:bun /app/services/bootstrap/package.json ./
COPY --from=builder --chown=bun:bun /app/services/bootstrap/dist ./dist
COPY --from=builder --chown=bun:bun /app/services/bootstrap/drizzle ./drizzle

USER bun

ENV NODE_ENV=production

CMD ["bun", "dist/index.js"]
