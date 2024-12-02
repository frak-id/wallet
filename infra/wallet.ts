import {
    alchemyApiKey,
    backendUrl,
    indexerUrl,
    isProd,
    nexusRpcSecret,
    pimlicoApiKey,
    umamiWalletWebsiteId,
    vapidPublicKey,
} from "./config";

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
    // Environment variables
    environment: {
        STAGE: $app.stage,
        BACKEND_URL: backendUrl,
        INDEXER_URL: indexerUrl,
        ALCHEMY_API_KEY: alchemyApiKey.value,
        PIMLICO_API_KEY: pimlicoApiKey.value,
        NEXUS_RPC_SECRET: nexusRpcSecret.value,
        VAPID_PUBLIC_KEY: vapidPublicKey.value,
        UMAMI_WALLET_WEBSITE_ID: umamiWalletWebsiteId.value,
    },
});
