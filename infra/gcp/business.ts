import path from "node:path";
import type { Resource } from "@pulumi/pulumi";
import { KubernetesService } from "../components/KubernetesService";
import {
    backendUrl,
    drpcApiKey,
    erpcUrl,
    indexerUrl,
    jwtBusinessSecret,
    mongoBusinessDb,
    nexusRpcSecret,
    onRampUrl,
    openPanelApiUrl,
    openPanelBusinessClientId,
    walletUrl,
} from "../config";
import { isProd, normalizedStageName } from "../utils";
import { baseDomainName, getRegistryPath, walletNamespace } from "./utils";

const subDomain = isProd ? "business" : "business-dev";

const businessEnv = {
    STAGE: normalizedStageName,
    FRAK_WALLET_URL: walletUrl,
    BACKEND_URL: backendUrl,
    INDEXER_URL: indexerUrl,
    ERPC_URL: erpcUrl,
    OPEN_PANEL_API_URL: openPanelApiUrl,
    OPEN_PANEL_BUSINESS_CLIENT_ID: openPanelBusinessClientId.value,
    DRPC_API_KEY: drpcApiKey.value,
    NEXUS_RPC_SECRET: nexusRpcSecret.value,
    JWT_BUSINESS_SECRET: jwtBusinessSecret.value,
    MONGODB_BUSINESS_URI: mongoBusinessDb.value,
    FUNDING_ON_RAMP_URL: onRampUrl.value,
};

let businessImage = $output("");
const dependency: Resource[] = [];

if (!$dev) {
    const { baseImage } = await import("./images");
    // Build the business SSR image
    const image = new dockerbuild.Image(
        "business",
        {
            context: {
                location: $cli.paths.root,
            },
            dockerfile: {
                location: path.join(
                    $cli.paths.root,
                    "apps/business/Dockerfile"
                ),
            },
            // Non-secret build args
            buildArgs: {
                NODE_ENV: "production",
                BASE_IMAGE: baseImage.ref,
                STAGE: businessEnv.STAGE,
                FRAK_WALLET_URL: businessEnv.FRAK_WALLET_URL,
                BACKEND_URL: businessEnv.BACKEND_URL,
                INDEXER_URL: businessEnv.INDEXER_URL,
                ERPC_URL: businessEnv.ERPC_URL,
                OPEN_PANEL_API_URL: businessEnv.OPEN_PANEL_API_URL,
            },
            // Secrets passed via BuildKit (not stored in layers)
            secrets: {
                DRPC_API_KEY: businessEnv.DRPC_API_KEY,
                NEXUS_RPC_SECRET: businessEnv.NEXUS_RPC_SECRET,
                FUNDING_ON_RAMP_URL: businessEnv.FUNDING_ON_RAMP_URL,
                OPEN_PANEL_BUSINESS_CLIENT_ID:
                    businessEnv.OPEN_PANEL_BUSINESS_CLIENT_ID,
            },
            platforms: ["linux/amd64"],
            push: true,
            tags: getRegistryPath("business"),
        },
        {
            dependsOn: [baseImage],
        }
    );

    dependency.push(image);

    businessImage = image.ref;
}

// Wallet service (owns the ingress and routes paths)
export const businessService = new KubernetesService(
    "business",
    {
        namespace: walletNamespace.metadata.name,
        appLabels: {
            app: "business-frontend",
        },

        // Dev command (runs when `sst dev` is active)
        dev: {
            dev: {
                command: "bun run dev",
                directory: "apps/business",
                autostart: true,
            },
            environment: businessEnv,
        },

        // Pod config
        pod: {
            containers: [
                {
                    name: "business",
                    image: businessImage,
                    ports: [{ containerPort: 3022 }],
                    resources: {
                        limits: { cpu: "50m", memory: "256Mi" },
                        requests: { cpu: "20m", memory: "64Mi" },
                    },
                    env: Object.entries(businessEnv).map(([name, value]) => ({
                        name,
                        value,
                    })),
                },
            ],
        },

        // Service config
        service: {
            ports: [
                { port: 80, targetPort: 3022, protocol: "TCP", name: "http" },
            ],
        },

        // Ingress config with path-based routing
        ingress: {
            host: `${subDomain}.frak.id`,
            tlsSecretName: "business-tls",
            additionalHosts: [`business.${baseDomainName}`],
        },
    },
    {
        dependsOn: dependency,
    }
);
