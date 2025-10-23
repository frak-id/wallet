import path from "node:path";
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
    privyAppId,
    vapidPublicKey,
    walletUrl,
} from "../config";
import { isProd } from "../utils";
import { baseDomainName, getRegistryPath, walletNamespace } from "./utils";

// todo: for now on wallet.gcp-dev.frak.id, to test that up a bit, and we wil llater migrate it to the real wallet.frak.id
const domain = `${isProd ? "wallet" : "wallet-dev"}.${baseDomainName}`;

const walletEnv = {
    STAGE: $app.stage,
    BACKEND_URL: backendUrl,
    INDEXER_URL: indexerUrl,
    ERPC_URL: erpcUrl,
    DRPC_API_KEY: drpcApiKey.value,
    PIMLICO_API_KEY: pimlicoApiKey.value,
    NEXUS_RPC_SECRET: nexusRpcSecret.value,
    VAPID_PUBLIC_KEY: vapidPublicKey.value,
    PRIVY_APP_ID: privyAppId.value,
    FRAK_WALLET_URL: walletUrl,
    OPEN_PANEL_API_URL: openPanelApiUrl,
    OPEN_PANEL_WALLET_CLIENT_ID: openPanelWalletClientId.value,
};

// Build the custom Nginx image with frontend files built-in
export const walletImage = new dockerbuild.Image("wallet", {
    context: {
        location: $cli.paths.root,
    },
    dockerfile: {
        location: path.join($cli.paths.root, "apps/wallet/Dockerfile"),
    },
    buildArgs: {
        NODE_ENV: "production",
        ...walletEnv,
    },
    platforms: ["linux/amd64"],
    push: true,
    tags: getRegistryPath("wallet"),
});

// Build the custom Nginx image with frontend files built-in
export const listenerImage = new dockerbuild.Image("wallet-listener", {
    context: {
        location: $cli.paths.root,
    },
    dockerfile: {
        location: path.join($cli.paths.root, "apps/listener/Dockerfile"),
    },
    buildArgs: {
        NODE_ENV: "production",
        ...walletEnv,
    },
    platforms: ["linux/amd64"],
    push: true,
    tags: getRegistryPath("wallet-listener"),
});

// Listener service (backend only, no ingress - accessed via wallet ingress)
export const listenerService = new KubernetesService(
    "wallet-listener",
    {
        namespace: walletNamespace.metadata.name,
        appLabels: {
            app: "wallet-listener",
        },

        // Pod config
        pod: {
            containers: [
                {
                    name: "listener",
                    image: listenerImage.ref,
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
        dependsOn: [listenerImage],
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

        // Pod config
        pod: {
            containers: [
                {
                    name: "wallet",
                    image: walletImage.ref,
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
            host: domain,
            tlsSecretName: "wallet-tls",
            // Route /listener to the listener service
            pathRoutes: [
                {
                    path: "/listener(/|$)(.*)",
                    pathType: "Prefix",
                    serviceName: listenerService.service?.metadata?.name ?? "",
                    servicePort: 80,
                },
            ],
            // Rewrite /listener/* to /* for the listener service
            customAnnotations: {
                "nginx.ingress.kubernetes.io/rewrite-target": "/$2",
                "nginx.ingress.kubernetes.io/use-regex": "true",
            },
        },
    },
    {
        dependsOn: [walletImage, listenerService],
    }
);
