import { KubernetesJob } from "../components/KubernetesJob";
import { KubernetesService } from "../components/KubernetesService";
import { isProd, normalizedStageName } from "../utils";
import { backendUpstreamTraffic, gatewayRoute } from "./gateway";
import { bootstrapImage, elysiaImage } from "./images";
import { bootstrapEnv, elysiaEnv } from "./secrets";
import { walletNamespace } from "./utils";

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

const bootstrapSecrets = new kubernetes.core.v1.Secret("bootstrap-secret", {
    metadata: {
        name: `bootstrap-secret-${normalizedStageName}`,
        namespace: walletNamespace.metadata.name,
    },
    type: "Opaque",
    stringData: bootstrapEnv,
});

/**
 * Bootstrap Job: runs Drizzle migrations (Postgres + libSQL) and provisions RustFS buckets.
 * Backend Service depends on this completing successfully.
 */
const bootstrapJob = new KubernetesJob("ElysiaBootstrap", {
    namespace: walletNamespace.metadata.name,
    appLabels,
    job: {
        container: {
            name: "bootstrap",
            image: bootstrapImage.ref,
            envFrom: [
                {
                    secretRef: {
                        name: bootstrapSecrets.metadata.name,
                    },
                },
            ],
        },
    },
});

export const backendInstance = new KubernetesService(
    "Elysia",
    {
        namespace: walletNamespace.metadata.name,
        appLabels,

        pod: {
            containers: [
                {
                    name: "elysia",
                    image: elysiaImage.ref,
                    ports: [
                        { containerPort: 3030, name: "http" },
                        // Cluster-internal Prometheus metrics port. NOT routed
                        // by the Gateway — only scraped pod-to-pod.
                        { containerPort: 9464, name: "metrics" },
                    ],
                    env: [
                        {
                            name: "BUN_JSC_forceRAMSize",
                            value: "419430400",
                        },
                    ],
                    envFrom: [
                        {
                            secretRef: { name: elysiaSecrets.metadata.name },
                        },
                    ],
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
                    resources: {
                        requests: {
                            cpu: isProd ? "200m" : "50m",
                            memory: "256Mi",
                        },
                        limits: { cpu: "400m", memory: "512Mi" },
                    },
                },
            ],
        },

        service: {
            ports: [
                { port: 80, targetPort: 3030, protocol: "TCP", name: "http" },
                // Metrics port is exposed on the ClusterIP service only (no
                // route references it), so it stays internal.
                {
                    port: 9464,
                    targetPort: 9464,
                    protocol: "TCP",
                    name: "metrics",
                },
            ],
        },

        hpa: {
            min: 1,
            max: 2,
            // Yup 120% cpu, limits = request x2, and hpa based on requests cpu usage
            cpuUtilization: 120,
        },

        httpRoute: {
            ...gatewayRoute("backend", "backend"),
            rules: [
                {
                    name: "pairing-ws",
                    path: "/user/wallet/pairings/ws",
                    pathType: "Exact",
                    // Bun's `websocket.idleTimeout`: a pairing can wait minutes
                    traffic: { streamIdleTimeout: "300s" },
                },
            ],
            traffic: { ...backendUpstreamTraffic, compression: true },
        },

        // ServiceMonitor config — scrapes the dedicated, cluster-internal
        // `metrics` port (9464). Kept off the public `http` port so /metrics
        // is never reachable through the Gateway.
        serviceMonitor: {
            port: "metrics",
            path: "/metrics",
            interval: "15s",
        },
    },
    {
        dependsOn: [elysiaImage, elysiaSecrets, bootstrapJob],
    }
);
