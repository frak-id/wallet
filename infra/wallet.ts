import {
    alchemyApiKey,
    backendUrl,
    indexerUrl,
    isProd,
    nexusRpcSecret,
    pimlicoApiKey,
    umamiWalletWebsiteId,
    vapidPublicKey,
    walletUrl,
} from "./config";

const subdomain = isProd ? "wallet" : "wallet-dev";

/**
 * EthCC wallet demo website
 */
export const walletWebsite = new sst.aws.Remix("Wallet", {
    path: "packages/wallet",
    // Set the custom domain
    domain: {
        // name: `${subdomain}.frak.id`,
        name: `${subdomain}.frak-labs.com`,
    },
    // Environment variables
    environment: {
        STAGE: $app.stage,
        FRAK_WALLET_URL: walletUrl,
        BACKEND_URL: backendUrl,
        INDEXER_URL: indexerUrl,
    },
    link: [
        alchemyApiKey,
        pimlicoApiKey,
        nexusRpcSecret,
        vapidPublicKey,
        umamiWalletWebsiteId,
    ],
});
