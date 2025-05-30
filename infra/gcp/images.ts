import path from "node:path";
import { normalizedStageName } from "../utils";

const repository = `elysia-${normalizedStageName}`;

/**
 * Artifact registry for the elysia image
 */
const registry = new gcp.artifactregistry.Repository("elysia-gcr", {
    repositoryId: repository,
    format: "DOCKER",
    description: "Artifact registry for the elysia image",
    location: "europe-west1",
    project: gcp.config.project,
});
const registryPath = registry.location.apply(
    (location) =>
        `${location}-docker.pkg.dev/${gcp.config.project}/${repository}`
);

/**
 * Create the elysia image
 */
export const elysiaImage = new dockerbuild.Image(
    "elysia-image",
    {
        context: {
            location: $cli.paths.root,
        },
        dockerfile: {
            location: path.join($cli.paths.root, "services/backend/Dockerfile"),
        },
        platforms: ["linux/arm64"],
        buildArgs: {
            NODE_ENV: "production",
            STAGE: normalizedStageName,
        },
        push: true,
        tags: registryPath.apply((path) => [
            `${path}/elysia:${process.env.COMMIT_HASH ? `git-${process.env.COMMIT_HASH}` : "local-build"}`,
            `${path}/elysia:latest`,
        ]),
    },
    {
        dependsOn: [registry],
    }
);

/**
 * Create the db migration image
 */
export const migrationImage = new dockerbuild.Image(
    "migration-image",
    {
        context: {
            location: $cli.paths.root,
        },
        dockerfile: {
            location: path.join(
                $cli.paths.root,
                "services/backend/MigrationDockerfile"
            ),
        },
        platforms: ["linux/arm64"],
        buildArgs: {
            NODE_ENV: "production",
            STAGE: normalizedStageName,
        },
        push: true,
        tags: registryPath.apply((path) => [
            `${path}/migration:${process.env.COMMIT_HASH ? `git-${process.env.COMMIT_HASH}` : "local-build"}`,
            `${path}/migration:latest`,
        ]),
    },
    {
        dependsOn: [registry],
    }
);
