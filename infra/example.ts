import { walletUrl } from "./config";
import { isV2, normalizedStageName } from "./utils";

/**
 * EthCC wallet demo website
 */
export const ethccWebsite = new sst.aws.StaticSite("WalletExampleEthCC", {
    path: "example/wallet-ethcc",
    // Set the custom domain
    domain: {
        name: isV2 ? "ethcc.v2.frak-labs.com" : "ethcc.frak-labs.com",
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
        STAGE: normalizedStageName,
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
        name: isV2 ? "vanilla.v2.frak-labs.com" : "vanilla.frak-labs.com",
    },
    build: {
        command: "bun run build",
        output: "dist",
    },
    vite: {
        types: "./sst-env.d.ts",
    },
    environment: {
        STAGE: normalizedStageName,
        FRAK_WALLET_URL: walletUrl,
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
        name: isV2 ? "showcase.v2.frak.id" : "showcase.frak.id",
    },
    build: {
        command: "bun run build",
        output: "dist",
    },
    vite: {
        types: "./sst-env.d.ts",
    },
    environment: {
        STAGE: normalizedStageName,
        FRAK_WALLET_URL: walletUrl,
    },
    dev: { autostart: false },
});
