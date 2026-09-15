import path from "node:path";
import { normalizedStageName } from "../utils";
import { cachedImage, getRegistryPath } from "./utils";

/**
 * Each image is self-contained: every Dockerfile builds the SDK in its own
 * `sdk-builder` stage, and the in-cluster zot cache (`cachedImage`, `mode: max`,
 * so intermediate stages are pushed) dedupes those layers across images.
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
