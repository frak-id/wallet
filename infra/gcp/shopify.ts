import path from "node:path";
import type { Resource } from "@pulumi/pulumi";
import { KubernetesService } from "../components/KubernetesService";
import {
    backendUrl,
    businessUrl,
    componentsUrl,
    nexusRpcSecret,
    productSetupCodeSalt,
    shopifyApiKey,
    shopifyApiSecret,
    shopifyAppUrl,
    shopifyPostgresHost,
    shopifyPostgresPassword,
    walletUrl,
} from "../config";
import { isProd, normalizedStageName } from "../utils";
import {
    baseDomainName,
    cachedImage,
    getRegistryPath,
    walletNamespace,
} from "./utils";

const subDomain = isProd ? "extension-shop" : "extension-shop-dev";

/**
 * Public, non-secret vars. These are inlined into the JS bundle at BUILD time by
 * Vite `define` (see apps/shopify/vite.config.ts), so they are passed as Docker
 * build args — NOT injected at runtime.
 */
const shopifyBuildEnv = {
    NODE_ENV: "production",
    STAGE: normalizedStageName,
    FRAK_WALLET_URL: walletUrl,
    FRAK_COMPONENTS_URL: componentsUrl,
    BUSINESS_URL: businessUrl,
    BACKEND_URL: backendUrl,
    SHOPIFY_API_KEY: shopifyApiKey,
    SHOPIFY_APP_URL: shopifyAppUrl,
};

/**
 * Secrets read from `process.env` at RUNTIME by the server (db.server.ts,
 * shopify.server.ts, services). Injected into the pod via a Kubernetes Secret.
 *
 * NOTE: `SHOPIFY_POSTGRES_HOST` currently points at the standalone Shopify
 * Postgres (previously reached from AWS Lambda). The GKE pods must have network
 * reachability to that host, or the DB should be migrated onto the GCP master.
 */
const shopifyRuntimeEnv = {
    STAGE: normalizedStageName,
    SHOPIFY_APP_URL: shopifyAppUrl,
    POSTGRES_SHOPIFY_DB: isProd ? "shopify_prod" : "shopify_dev",
    POSTGRES_USER: isProd ? "shopify-prod" : "shopify-dev",
    SHOPIFY_POSTGRES_HOST: shopifyPostgresHost.value,
    SHOPIFY_POSTGRES_PASSWORD: shopifyPostgresPassword.value,
    SHOPIFY_API_SECRET: shopifyApiSecret.value,
    PRODUCT_SETUP_CODE_SALT: productSetupCodeSalt.value,
    NEXUS_RPC_SECRET: nexusRpcSecret.value,
};

let shopifyImage = $output("");
const dependency: Resource[] = [];

if (!$dev) {
    const image = cachedImage("shopify", {
        context: {
            location: $cli.paths.root,
        },
        dockerfile: {
            location: path.join($cli.paths.root, "apps/shopify/Dockerfile"),
        },
        // All build args are public (baked by Vite define). No build secrets.
        buildArgs: shopifyBuildEnv,
        platforms: ["linux/amd64"],
        push: true,
        tags: getRegistryPath("shopify"),
    });

    dependency.push(image);
    shopifyImage = image.ref;
}

/**
 * Runtime secrets for the Shopify SSR server.
 */
const shopifySecrets = new kubernetes.core.v1.Secret("shopify-secrets", {
    metadata: {
        name: `shopify-secrets-${normalizedStageName}`,
        namespace: walletNamespace.metadata.name,
    },
    type: "Opaque",
    stringData: shopifyRuntimeEnv,
});

dependency.push(shopifySecrets);

/**
 * Shopify embedded app — React Router v7 SSR server on Kubernetes.
 * Replaces the previous `sst.aws.React` (Lambda + CloudFront) deployment.
 */
export const shopifyService = new KubernetesService(
    "shopify",
    {
        namespace: walletNamespace.metadata.name,
        appLabels: {
            app: "shopify-frontend",
        },

        // Dev command (runs when `sst dev` is active) — mirrors the old
        // `bun run shopify:dev` flow (Shopify CLI tunnel).
        dev: {
            dev: {
                command: "bun run shopify:dev",
                directory: "apps/shopify",
                autostart: false,
            },
            environment: { ...shopifyBuildEnv, ...shopifyRuntimeEnv },
        },

        // Pod config
        pod: {
            containers: [
                {
                    name: "shopify",
                    image: shopifyImage,
                    ports: [{ containerPort: 3000, name: "http" }],
                    env: [{ name: "PORT", value: "3000" }],
                    // Runtime secrets (DB creds, API secret, salts)
                    envFrom: [
                        {
                            secretRef: { name: shopifySecrets.metadata.name },
                        },
                    ],
                    livenessProbe: {
                        httpGet: { path: "/health", port: 3000 },
                        initialDelaySeconds: 15,
                        periodSeconds: 10,
                        timeoutSeconds: 5,
                        failureThreshold: 3,
                    },
                    readinessProbe: {
                        httpGet: { path: "/health", port: 3000 },
                        initialDelaySeconds: 5,
                        periodSeconds: 10,
                        timeoutSeconds: 3,
                        failureThreshold: 2,
                    },
                    resources: {
                        requests: {
                            cpu: isProd ? "100m" : "50m",
                            memory: "256Mi",
                        },
                        limits: { cpu: "400m", memory: "512Mi" },
                    },
                },
            ],
        },

        // Service config (ingress :80 -> container :3000)
        service: {
            ports: [
                { port: 80, targetPort: 3000, protocol: "TCP", name: "http" },
            ],
        },

        // HPA config
        hpa: {
            min: 1,
            max: isProd ? 3 : 2,
            cpuUtilization: 120,
        },

        // Ingress config
        ingress: {
            host: `${subDomain}.frak.id`,
            tlsSecretName: "shopify-tls",
            additionalHosts: [`${subDomain}.${baseDomainName}`],
        },
    },
    {
        dependsOn: dependency,
    }
);
