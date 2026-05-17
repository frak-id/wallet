# syntax=docker/dockerfile:1.10
#
# Elysia backend — self-contained multi-stage build.
#
# Runtime stays on the Debian-flavored `oven/bun` image because three runtime
# dependencies ship native binaries that are reliably available there:
#   - sharp           (libvips bindings; glibc prebuilds are first-class)
#   - lightningcss    (parcel CSS engine; glibc binary preferred)
#   - @libsql/client  (better-sqlite3 native bindings)
# These three are excluded from `bun build` and installed at runtime instead of
# being bundled. Switching to alpine would require validating musl prebuilds for
# all three on every dependency bump, which is not worth the ~150 MB savings.

ARG BUN_VERSION=1.3.11

FROM oven/bun:${BUN_VERSION} AS tooling
# Node 24 is required for the SDK build step (vanilla-extract VM-sandbox quirks);
# the backend itself uses `bun build`, but it transitively depends on @frak-labs/core-sdk
# being built via `bun run build:sdk`.
RUN --mount=type=cache,id=apt-cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,id=apt-lib,target=/var/lib/apt,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean \
    && apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y --no-install-recommends nodejs

FROM tooling AS deps
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

FROM deps AS sdk-builder
COPY --link sdk ./sdk
COPY --link packages/rpc ./packages/rpc
COPY --link packages/dev-tooling ./packages/dev-tooling
COPY --link packages/ui ./packages/ui
COPY --link packages/design-system ./packages/design-system
RUN bun run build:sdk

FROM sdk-builder AS app-builder
COPY --link packages ./packages
COPY --link services/backend ./services/backend

ARG STAGE
ENV NODE_ENV=production \
    STAGE=$STAGE

WORKDIR /app/services/backend
RUN bun run build

# Pre-install the runtime-only native modules into a scratch directory so the
# final image gets a clean, minimal node_modules layer instead of the previous
# `cp -rL /tmp/node_modules` dance.
FROM tooling AS runtime-deps
WORKDIR /runtime
RUN --mount=type=cache,id=bun-store,target=/root/.bun/install/cache,sharing=locked \
    bun init -y >/dev/null \
    && bun add sharp lightningcss @libsql/client

FROM oven/bun:${BUN_VERSION}
WORKDIR /app

COPY --from=app-builder --chown=bun:bun /app/services/backend/package.json ./
COPY --from=app-builder --chown=bun:bun /app/services/backend/dist ./dist
COPY --from=runtime-deps --chown=bun:bun /runtime/node_modules ./node_modules

USER bun

EXPOSE 3030

ENV NODE_ENV=production \
    # Disable transpiler cache in ephemeral containers (Bun docs recommendation)
    BUN_RUNTIME_TRANSPILER_CACHE_PATH=0

# Direct entrypoint — Bun is PID 1, receives SIGTERM cleanly.
# --smol enables JSC's stopIfNecessaryTimer for aggressive GC in constrained containers.
CMD ["bun", "--smol", "dist/index.js"]
