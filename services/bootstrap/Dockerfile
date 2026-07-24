# syntax=docker/dockerfile:1-labs
#
# Bootstrap orchestrator — runs Postgres + libSQL Drizzle migrations and RustFS
# bucket provisioning as a one-shot K8s Job before backend rollout.
#
# Bundled into a single `dist/index.js` via Bun's bundler (same approach as
# services/credential-sync); the runtime image ships dist/ + drizzle/ SQL files
# plus a minimal node_modules holding only `sharp` (native libvips bindings,
# kept external from the bundle — same approach as services/backend, which is
# also why the runtime is the Debian-flavored oven/bun image rather than
# alpine: sharp's glibc prebuilds are first-class, musl ones are not).
# The `drizzle/` directory must be present at runtime because drizzle-orm's
# migrator reads `.sql` files from disk (`./drizzle/{prod,dev,v2,local,libsql}`
# paths resolved relative to cwd).

ARG BUN_VERSION=1.3.11

FROM oven/bun:${BUN_VERSION} AS deps
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
# The backfill step pulls in workspace + cross-service source at bundle time:
#   - relative imports into `services/backend/src/domain/{auth,identity}/db/schema`
#   - `@frak-labs/app-essentials/blockchain` (workspace symlink to source)
# Only `package.json` files land here from the `deps` stage, so the actual
# source has to be copied explicitly. None of it ships in the runtime image.
COPY --link services/backend/src ./services/backend/src
COPY --link packages/app-essentials/src ./packages/app-essentials/src

ENV NODE_ENV=production

WORKDIR /app/services/bootstrap
RUN bun run build

# Pre-install the runtime-only native module (sharp) into a scratch directory so
# the final image gets a clean, minimal node_modules layer.
FROM oven/bun:${BUN_VERSION} AS runtime-deps
WORKDIR /runtime
RUN --mount=type=cache,id=bun-store,target=/root/.bun/install/cache,sharing=locked \
    bun init -y >/dev/null \
    && bun add sharp

FROM oven/bun:${BUN_VERSION}
WORKDIR /app/services/bootstrap

COPY --from=builder --chown=bun:bun /app/services/bootstrap/package.json ./
COPY --from=builder --chown=bun:bun /app/services/bootstrap/dist ./dist
COPY --from=builder --chown=bun:bun /app/services/bootstrap/drizzle ./drizzle
COPY --from=runtime-deps --chown=bun:bun /runtime/node_modules ./node_modules

USER bun

ENV NODE_ENV=production

CMD ["bun", "dist/index.js"]
