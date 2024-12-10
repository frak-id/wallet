import { backendUrl, walletUrl } from "./config";

/**
 * EthCC wallet demo website
 */
export const ethccWebsite = new sst.aws.StaticSite("WalletExampleEthCC", {
    path: "example/wallet-ethcc",
    // Set the custom domain
    domain: {
        name: "ethcc.news-paper.xyz",
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
        FRAK_WALLET_URL: walletUrl,
    },
});

/**
 * EthCC wallet demo website
 */
export const newsInteractionWebsite = new sst.aws.StaticSite(
    "NewsInteractionDemo",
    {
        path: "example/news-interactions",
        // Set the custom domain
        domain: {
            name: "news-paper.xyz",
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
            FRAK_WALLET_URL: walletUrl,
            BACKEND_URL: backendUrl,
        },
    }
);
