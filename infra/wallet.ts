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
} from "./config";
import { isProd } from "./utils";

const subdomain = isProd ? "wallet" : "wallet-dev";

/**
 * Wallet website
 */
new sst.aws.StaticSite("Wallet", {
    path: "apps/wallet",
    // Set the custom domain
    domain: {
        name: `${subdomain}.frak.id`,
    },
    build: {
        command: "bun run build",
        output: "build/client",
    },
    vite: {
        types: "./sst-env.d.ts",
    },
    // Environment variables
    environment: {
        STAGE: $app.stage,
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
    },
    dev: false,
});
