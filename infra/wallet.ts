import {
    backendUrl,
    drpcApiKey,
    erpcUrl,
    indexerUrl,
    nexusRpcSecret,
    pimlicoApiKey,
    privyAppId,
    umamiWalletWebsiteId,
    vapidPublicKey,
    walletUrl,
} from "./config";
import { isProd } from "./utils";

const subdomain = isProd ? "wallet" : "wallet-dev";

/**
 * Wallet website
 */
new sst.aws.StaticSite("Wallet", {
    path: "packages/wallet",
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
        UMAMI_WALLET_WEBSITE_ID: umamiWalletWebsiteId.value,
        PRIVY_APP_ID: privyAppId.value,
        FRAK_WALLET_URL: walletUrl,
    },
});
