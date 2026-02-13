import { KubernetesJob } from "../components/KubernetesJob";
import { KubernetesService } from "../components/KubernetesService";
import { isProd, normalizedStageName } from "../utils";
import { elysiaImage, migrationImage } from "./images";
import { elysiaEnv, postgresEnv } from "./secrets";
import { domainName, walletNamespace } from "./utils";

const appLabels = { app: "elysia" };

/**
 * All the secrets for the elysia instance
 */
const elysiaSecrets = new kubernetes.core.v1.Secret("elysia-secrets", {
    metadata: {
        name: `elysia-secrets-${normalizedStageName}`,
        namespace: walletNamespace.metadata.name,
    },
    type: "Opaque",
    stringData: elysiaEnv,
});

const dbMigrationSecrets = new kubernetes.core.v1.Secret(
    "db-migration-secret",
    {
        metadata: {
            name: `db-migration-section-${normalizedStageName}`,
            namespace: walletNamespace.metadata.name,
        },
        type: "Opaque",
        stringData: {
            STAGE: normalizedStageName,
            // Postgres related
            ...postgresEnv,
        },
    }
);

/**
 * Create the db migration job
 */
const migrationJob = new KubernetesJob("ElysiaDbMigration", {
    namespace: walletNamespace.metadata.name,
    appLabels,
    job: {
        container: {
            name: "db-migration",
            image: migrationImage.ref,
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

const legacyDomain = isProd ? "backend.frak.id" : "backend-dev.frak.id";

/**
 * Deploy elysia using the new service
 */
export const backendInstance = new KubernetesService(
    "Elysia",
    {
        // Global config
        namespace: walletNamespace.metadata.name,
        appLabels,

        // Pod config
        pod: {
            containers: [
                {
                    name: "elysia",
                    image: elysiaImage.ref,
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
                    // Ressources requests/limits
                    resources: {
                        requests: {
                            cpu: isProd ? "200m" : "50m",
                            memory: isProd ? "256Mi" : "128Mi",
                        },
                        limits: { cpu: "400m", memory: "512Mi" },
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
            // Yup 120% cpu, limits = request x2, and hpa based on requests cpu usage
            cpuUtilization: 120,
        },

        // Ingress config
        ingress: {
            host: domainName,
            tlsSecretName: "elysia-tls",
            // For legacy purposes
            additionalHosts: [legacyDomain],
            // Performance optimizations for API backend
            customAnnotations: {
                // Connection pooling for ingress -> backend pod connections
                "nginx.ingress.kubernetes.io/upstream-keepalive-connections":
                    "32",
                "nginx.ingress.kubernetes.io/upstream-keepalive-requests":
                    "1000",
                "nginx.ingress.kubernetes.io/upstream-keepalive-timeout": "60",
                // Optimized timeouts for API responses
                "nginx.ingress.kubernetes.io/proxy-connect-timeout": "5",
                "nginx.ingress.kubernetes.io/proxy-send-timeout": "30",
                "nginx.ingress.kubernetes.io/proxy-read-timeout": "30",
                // Buffer settings for API responses
                "nginx.ingress.kubernetes.io/proxy-buffering": "on",
                "nginx.ingress.kubernetes.io/proxy-buffers-number": "4",
                "nginx.ingress.kubernetes.io/proxy-buffer-size": "8k",
            },
        },

        // ServiceMonitor config
        // todo: expose some prom metrics
        // serviceMonitor: {
        //     port: "metrics",
        //     path: "/metrics",
        //     interval: "15s",
        // },
    },
    {
        dependsOn: [elysiaImage, elysiaSecrets, migrationJob],
    }
);
