import path from "node:path";
import { KubernetesService } from "../components/KubernetesService";
import { normalizedStageName } from "../utils";
import { baseDomainName, backendNamespace, getDbUrl, domainName } from "./utils";
import { elysiaSecrets } from "./secrets";

const appLabels = { app: "elysia" };
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

/**
 * Create the erpc image
 */
const registryPath = registry.location.apply(
    (location) =>
        `${location}-docker.pkg.dev/${gcp.config.project}/${repository}`
);
const latestTag = registryPath.apply((path) => `${path}/${imageName}:latest`);
const elysiaImage = new docker.Image(
    imageName,
    {
        imageName: latestTag,
        build: {
            context: $cli.paths.root,
            dockerfile: "infra/docker/ElysiaDockerfile",
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
 * Deploy elysia using the new service
 */
export const backendInstance = new KubernetesService(
    "Elysia",
    {
        // Global config
        namespace: backendNamespace.metadata.name,
        appLabels,

        // Pod config
        pod: {
            containers: [
                {
                    name: "elysia",
                    image: elysiaImage.imageName,
                    ports: [{ containerPort: 3030 }],
                    env: [],
                    // Mount all the secrets
                    envFrom: [
                        {
                            secretRef: { name: elysiaSecrets.metadata.name },
                        },
                    ],
                    // Add liveness probe
                    livenessProbe: {
                        httpGet: {
                            path: "/health",
                            port: 3030,
                        },
                        initialDelaySeconds: 15,
                        periodSeconds: 10,
                        timeoutSeconds: 5,
                        failureThreshold: 3,
                    },
                    // Add readiness probe
                    readinessProbe: {
                        httpGet: {
                            path: "/health",
                            port: 3030,
                        },
                        initialDelaySeconds: 5,
                        periodSeconds: 10,
                        timeoutSeconds: 3,
                        failureThreshold: 2,
                    },
                },
            ],
        },

        // Service config
        service: {
            ports: [
                { port: 80, targetPort: 3030, protocol: "TCP", name: "http" },
            ],
        },

        // HPA config
        hpa: {
            min: 1,
            max: 2,
            cpuUtilization: 80,
        },

        // Ingress config
        ingress: {
            host: domainName,
            tlsSecretName: "elysia-tls",
        },

        // ServiceMonitor config
        // todo: expose some prom metrics
        // serviceMonitor: {
        //     port: "metrics",
        //     path: "/metrics",
        //     interval: "15s",
        // },

        // Local command
        dev: {
            dev: {
                autostart: true,
                directory: "packages/backend-elysia",
                command: "bun run dev",
            },
            environment: elysiaSecrets.data
        },
    },
    {
        dependsOn: [registry, elysiaImage, elysiaSecrets],
    }
);
