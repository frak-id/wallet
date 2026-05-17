import path from "node:path";
import { normalizedStageName } from "../utils";
import { cachedImage, getRegistryPath } from "./utils";

/**
 * Each image is self-contained (multi-stage Dockerfile). The shared SDK build
 * layer is no longer materialized as a separate "base" image; instead, every
 * Dockerfile builds the SDK locally inside a `sdk-builder` stage, and the
 * in-cluster zot registry cache (wired by `cachedImage`) makes the cost of that
 * step amortized — identical input layers (Node 24 install, bun install, SDK
 * build output) dedupe at the blob level across images.
 *
 * `mode: max` on the cache export means intermediate stages are pushed too,
 * which is what makes the dedup actually happen.
 */

/**
 * Elysia backend.
 */
export const elysiaImage = cachedImage("elysia-image", {
    context: { location: $cli.paths.root },
    dockerfile: {
        location: path.join($cli.paths.root, "services/backend/Dockerfile"),
    },
    platforms: ["linux/amd64"],
    buildArgs: {
        NODE_ENV: "production",
        STAGE: normalizedStageName,
    },
    push: true,
    tags: getRegistryPath("backend"),
});

/**
 * Bootstrap (Postgres + libSQL Drizzle migrations + RustFS bucket provisioning).
 */
export const bootstrapImage = cachedImage("bootstrap-image", {
    context: { location: $cli.paths.root },
    dockerfile: {
        location: path.join($cli.paths.root, "services/bootstrap/Dockerfile"),
    },
    platforms: ["linux/amd64"],
    buildArgs: {
        NODE_ENV: "production",
        STAGE: normalizedStageName,
    },
    push: true,
    tags: getRegistryPath("bootstrap"),
});

/**
 * Bidirectional MongoDB to sqld credential sync service.
 */
export const credentialSyncImage = cachedImage("credential-sync-image", {
    context: { location: $cli.paths.root },
    dockerfile: {
        location: path.join(
            $cli.paths.root,
            "services/credential-sync/Dockerfile"
        ),
    },
    platforms: ["linux/amd64"],
    buildArgs: {
        NODE_ENV: "production",
    },
    push: true,
    tags: getRegistryPath("credential-sync"),
});
