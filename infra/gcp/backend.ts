import { KubernetesJob } from "../components/KubernetesJob";
import { KubernetesService } from "../components/KubernetesService";
import { elysiaImage, migrationImage } from "./images";
import { dbMigrationSecrets, elysiaSecrets } from "./secrets";
import { backendNamespace, domainName } from "./utils";

const appLabels = { app: "elysia" };

// todo: job handling db migration stuff
/**
 * Create the db migration job
 */
const migrationJob = new KubernetesJob("ElysiaDbMigration", {
    namespace: backendNamespace.metadata.name,
    appLabels,
    job: {
        container: {
            name: "db-migration",
            image: migrationImage.imageName,
            envFrom: [
                {
                    secretRef: {
                        name: dbMigrationSecrets.metadata.name,
                    },
                },
            ],
        },
    },
});

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
            environment: elysiaSecrets.data,
        },
    },
    {
        dependsOn: [elysiaImage, elysiaSecrets, migrationJob],
    }
);
