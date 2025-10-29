import path from "node:path";
import type { Resource } from "@pulumi/pulumi";
import { KubernetesService } from "../components/KubernetesService";
import {
    backendUrl,
    drpcApiKey,
    erpcUrl,
    indexerUrl,
    nexusRpcSecret,
    openPanelApiUrl,
    openPanelWalletClientId,
    pimlicoApiKey,
    vapidPublicKey,
    walletUrl,
} from "../config";
import { isProd, normalizedStageName } from "../utils";
import { baseDomainName, getRegistryPath, walletNamespace } from "./utils";

// todo: for now on wallet.gcp-dev.frak.id, to test that up a bit, and we wil llater migrate it to the real wallet.frak.id
const subDomain = isProd ? "wallet" : "wallet-dev";

const walletEnv = {
    STAGE: normalizedStageName,
    BACKEND_URL: backendUrl,
    INDEXER_URL: indexerUrl,
    ERPC_URL: erpcUrl,
    DRPC_API_KEY: drpcApiKey.value,
    PIMLICO_API_KEY: pimlicoApiKey.value,
    NEXUS_RPC_SECRET: nexusRpcSecret.value,
    VAPID_PUBLIC_KEY: vapidPublicKey.value,
    FRAK_WALLET_URL: walletUrl,
    OPEN_PANEL_API_URL: openPanelApiUrl,
    OPEN_PANEL_WALLET_CLIENT_ID: openPanelWalletClientId.value,
    OPEN_PANEL_LISTENER_CLIENT_ID: openPanelWalletClientId.value,
};

let imageRefs = {
    wallet: $output(""),
    listener: $output(""),
};
const dependency: Resource[] = [];

if (!$dev) {
    const { baseImage } = await import("./images");
    // Build the custom Nginx image with frontend files built-in
    const walletImage = new dockerbuild.Image(
        "wallet",
        {
            context: {
                location: $cli.paths.root,
            },
            dockerfile: {
                location: path.join($cli.paths.root, "apps/wallet/Dockerfile"),
            },
            // Non-secret build args
            buildArgs: {
                NODE_ENV: "production",
                BASE_IMAGE: baseImage.ref,
                STAGE: walletEnv.STAGE,
                BACKEND_URL: walletEnv.BACKEND_URL,
                INDEXER_URL: walletEnv.INDEXER_URL,
                ERPC_URL: walletEnv.ERPC_URL,
                FRAK_WALLET_URL: walletEnv.FRAK_WALLET_URL,
                OPEN_PANEL_API_URL: walletEnv.OPEN_PANEL_API_URL,
            },
            // Secrets passed via BuildKit (not stored in layers)
            secrets: {
                DRPC_API_KEY: walletEnv.DRPC_API_KEY,
                PIMLICO_API_KEY: walletEnv.PIMLICO_API_KEY,
                NEXUS_RPC_SECRET: walletEnv.NEXUS_RPC_SECRET,
                VAPID_PUBLIC_KEY: walletEnv.VAPID_PUBLIC_KEY,
                OPEN_PANEL_WALLET_CLIENT_ID:
                    walletEnv.OPEN_PANEL_WALLET_CLIENT_ID,
            },
            platforms: ["linux/amd64"],
            push: true,
            tags: getRegistryPath("wallet"),
        },
        {
            dependsOn: [baseImage],
        }
    );

    // Build the custom Nginx image with frontend files built-in
    const listenerImage = new dockerbuild.Image(
        "wallet-listener",
        {
            context: {
                location: $cli.paths.root,
            },
            dockerfile: {
                location: path.join(
                    $cli.paths.root,
                    "apps/listener/Dockerfile"
                ),
            },
            // Non-secret build args
            buildArgs: {
                NODE_ENV: "production",
                BASE_IMAGE: baseImage.ref,
                STAGE: walletEnv.STAGE,
                BACKEND_URL: walletEnv.BACKEND_URL,
                INDEXER_URL: walletEnv.INDEXER_URL,
                ERPC_URL: walletEnv.ERPC_URL,
                FRAK_WALLET_URL: walletEnv.FRAK_WALLET_URL,
                OPEN_PANEL_API_URL: walletEnv.OPEN_PANEL_API_URL,
            },
            // Secrets passed via BuildKit (not stored in layers)
            secrets: {
                DRPC_API_KEY: walletEnv.DRPC_API_KEY,
                PIMLICO_API_KEY: walletEnv.PIMLICO_API_KEY,
                NEXUS_RPC_SECRET: walletEnv.NEXUS_RPC_SECRET,
                OPEN_PANEL_LISTENER_CLIENT_ID:
                    walletEnv.OPEN_PANEL_LISTENER_CLIENT_ID,
            },
            platforms: ["linux/amd64"],
            push: true,
            tags: getRegistryPath("wallet-listener"),
        },
        {
            dependsOn: [baseImage],
        }
    );

    dependency.push(walletImage, listenerImage);

    imageRefs = {
        wallet: walletImage.ref,
        listener: listenerImage.ref,
    };
}

// Listener service (backend only, no ingress - accessed via wallet ingress)
export const listenerService = new KubernetesService(
    "wallet-listener",
    {
        namespace: walletNamespace.metadata.name,
        appLabels: {
            app: "wallet-listener",
        },

        // Dev command (runs when `sst dev` is active)
        dev: {
            dev: {
                command: "bun run dev",
                directory: "apps/listener",
                autostart: true,
            },
            environment: walletEnv,
        },

        // Pod config
        pod: {
            containers: [
                {
                    name: "listener",
                    image: imageRefs.listener,
                    ports: [{ containerPort: 80 }],
                    resources: {
                        limits: { cpu: "10m", memory: "64Mi" },
                        requests: { cpu: "1m", memory: "8Mi" },
                    },
                    env: Object.entries(walletEnv).map(([name, value]) => ({
                        name,
                        value,
                    })),
                },
            ],
        },

        // Service config (ClusterIP, no ingress)
        service: {
            ports: [
                { port: 80, targetPort: 80, protocol: "TCP", name: "http" },
            ],
        },

        // No ingress - accessed via wallet's ingress path routing
    },
    {
        dependsOn: dependency,
    }
);

// Wallet service (owns the ingress and routes paths)
export const walletService = new KubernetesService(
    "wallet",
    {
        namespace: walletNamespace.metadata.name,
        appLabels: {
            app: "wallet-frontend",
        },

        // Dev command (runs when `sst dev` is active)
        dev: {
            dev: {
                command: "bun run dev",
                directory: "apps/wallet",
                autostart: true,
            },
            environment: walletEnv,
        },

        // Pod config
        pod: {
            containers: [
                {
                    name: "wallet",
                    image: imageRefs.wallet,
                    ports: [{ containerPort: 80 }],
                    resources: {
                        limits: { cpu: "10m", memory: "64Mi" },
                        requests: { cpu: "1m", memory: "8Mi" },
                    },
                    env: Object.entries(walletEnv).map(([name, value]) => ({
                        name,
                        value,
                    })),
                },
            ],
        },

        // Service config
        service: {
            ports: [
                { port: 80, targetPort: 80, protocol: "TCP", name: "http" },
            ],
        },

        // Ingress config with path-based routing
        ingress: {
            host: `${subDomain}.frak.id`,
            tlsSecretName: "wallet-tls",
            additionalHosts: [`wallet.${baseDomainName}`],
            // Route /listener to the listener service
            pathRoutes: [
                {
                    path: "/listener",
                    pathType: "Prefix",
                    serviceName: listenerService.service?.metadata?.name ?? "",
                    servicePort: 80,
                },
            ],
            // No rewrite needed - listener nginx handles /listener prefix internally
            customAnnotations: {
                "nginx.ingress.kubernetes.io/proxy-buffering": "off",
                "nginx.ingress.kubernetes.io/proxy-body-size": "10m",
            },
        },
    },
    {
        dependsOn: dependency,
    }
);
