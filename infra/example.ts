import { backendUrl, walletUrl } from "./config";

/**
 * EthCC wallet demo website
 */
export const ethccWebsite = new sst.aws.Remix("WalletExampleEthCC", {
    path: "example/wallet-ethcc",
    // Set the custom domain
    domain: {
        name: "ethcc.news-paper.xyz",
    },
    // Environment variables
    environment: {
        STAGE: $app.stage,
        FRAK_WALLET_URL: walletUrl,
    },
});

/**
 * EthCC wallet demo website
 */
export const newsInteractionWebsite = new sst.aws.Remix("NewsInteractionDemo", {
    path: "example/news-interactions",
    // Set the custom domain
    domain: {
        name: "news-paper.xyz",
    },
    // Environment variables
    environment: {
        STAGE: $app.stage,
        FRAK_WALLET_URL: walletUrl,
        BACKEND_URL: backendUrl,
    },
});
