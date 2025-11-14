import { walletUrl } from "./config";

/**
 * EthCC wallet demo website
 */
export const ethccWebsite = new sst.aws.StaticSite("WalletExampleEthCC", {
    path: "example/wallet-ethcc",
    // Set the custom domain
    domain: {
        name: "ethcc.frak-labs.com",
    },
    build: {
        command: "bun run build",
        output: "dist",
    },
    vite: {
        types: "./sst-env.d.ts",
    },
    // Environment variables
    environment: {
        STAGE: $app.stage,
        FRAK_WALLET_URL: walletUrl,
    },
    dev: { autostart: false },
});

/**
 * Vanilla JS demo website
 */
export const vanillaJsWebsite = new sst.aws.StaticSite("VanillaJsDemo", {
    path: "example/vanilla-js",
    // Set the custom domain
    domain: {
        name: "vanilla.frak-labs.com",
    },
    build: {
        command: "bun run build",
        output: "dist",
    },
    vite: {
        types: "./sst-env.d.ts",
    },
    dev: { autostart: false },
});

/**
 * Frak SDK showcase website
 */
export const showcaseWebsite = new sst.aws.StaticSite("ShowcaseDemo", {
    path: "example/showcase",
    // Set the custom domain
    domain: {
        name: "showcase.frak.id",
    },
    build: {
        command: "bun run build",
        output: "dist",
    },
    vite: {
        types: "./sst-env.d.ts",
    },
    dev: { autostart: false },
});
