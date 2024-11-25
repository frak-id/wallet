import { vpc, walletUrl } from "./config";

/**
 * EthCC wallet demo website
 */
export const ethccWebsite = new sst.aws.Remix("WalletExampleEthCC", {
    path: "example/wallet-ethcc",
    vpc,
    // Set the custom domain
    domain: {
        // name: "ethcc.news-paper.xyz",
        name: "ethcc.frak-labs.com",
    },
    // Environment variables
    environment: {
        FRAK_WALLET_URL: walletUrl,
    },
});

/**
 * EthCC wallet demo website
 */
// export const newsInteractionWebsite = new sst.aws.Remix("NewsInteractionDemo", {
//     path: "example/news-interactions",
//     vpc,
//     // Set the custom domain
//     domain: {
//         name: "news-paper.xyz",
//     },
//     // Environment variables
//     environment: {
//         FRAK_WALLET_URL: walletUrl,
//         BACKEND_URL: backendUrl
//     },
// });
