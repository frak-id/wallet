import path from "node:path";
import { normalizedStageName } from "../utils";
import { getRegistryPath } from "./utils";

/**
 * Create the base builder image with SDK pre-built
 * This is used by all app images to avoid rebuilding the SDK multiple times
 */
export const baseImage = new dockerbuild.Image("base-image", {
    context: {
        location: $cli.paths.root,
    },
    dockerfile: {
        location: path.join($cli.paths.root, "Dockerfile.base"),
    },
    platforms: ["linux/amd64"],
    buildArgs: {
        NODE_ENV: "production",
    },
    push: true,
    tags: getRegistryPath("base"),
});

/**
 * Create the elysia image
 */
export const elysiaImage = new dockerbuild.Image("elysia-image", {
    context: {
        location: $cli.paths.root,
    },
    dockerfile: {
        location: path.join($cli.paths.root, "services/backend/Dockerfile"),
    },
    platforms: ["linux/amd64"],
    buildArgs: {
        NODE_ENV: "production",
        STAGE: normalizedStageName,
        BASE_IMAGE: baseImage.ref,
    },
    push: true,
    tags: getRegistryPath("backend"),
});

/**
 * Create the db migration image
 */
export const migrationImage = new dockerbuild.Image("migration-image", {
    context: {
        location: $cli.paths.root,
    },
    dockerfile: {
        location: path.join(
            $cli.paths.root,
            "services/backend/MigrationDockerfile"
        ),
    },
    platforms: ["linux/amd64"],
    buildArgs: {
        NODE_ENV: "production",
        STAGE: normalizedStageName,
    },
    push: true,
    tags: getRegistryPath("db-migration"),
});
