import {
    alchemyApiKey,
    backendUrl,
    indexerUrl,
    isProd,
    nexusRpcSecret,
    pimlicoApiKey,
    umamiWalletWebsiteId,
    vapidPublicKey,
    vpc,
    walletUrl,
} from "./config";

const subdomain = isProd ? "wallet" : "wallet-dev";

/**
 * EthCC wallet demo website
 */
export const walletWebsite = new sst.aws.Remix("Wallet", {
    path: "packages/wallet",
    vpc,
    // Set the custom domain
    domain: {
        name: `${subdomain}.frak.id`,
    },
    // Environment variables
    environment: {
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
