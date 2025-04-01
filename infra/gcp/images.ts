import path from "node:path";
import { normalizedStageName } from "../utils";

const imageName = "elysia";
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
const latestTag = registryPath.apply((path) => `${path}/${imageName}:latest`);
export const elysiaImage = new docker.Image(
    imageName,
    {
        imageName: latestTag,
        build: {
            context: $cli.paths.root,
            dockerfile: path.join(
                $cli.paths.root,
                "packages/backend-elysia/Dockerfile"
            ),
            platform: "linux/arm64",
            args: {
                NODE_ENV: "production",
                STAGE: normalizedStageName,
            },
        },
    },
    {
        dependsOn: [registry],
    }
);

/**
 * Create the db migration image
 */
const migrationTag = registryPath.apply((path) => `${path}/migration:latest`);
export const migrationImage = new docker.Image(
    "migration",
    {
        imageName: migrationTag,
        build: {
            context: $cli.paths.root,
            dockerfile: path.join(
                $cli.paths.root,
                "packages/backend-elysia/MigrationDockerfile"
            ),
            platform: "linux/arm64",
            args: {
                NODE_ENV: "production",
                STAGE: normalizedStageName,
            },
        },
    },
    {
        dependsOn: [registry],
    }
);
