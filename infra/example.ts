import { walletUrl } from "./config";
import { normalizedStageName } from "./utils";

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
        STAGE: normalizedStageName,
        FRAK_WALLET_URL: walletUrl,
    },
    dev: { autostart: false },
});

/**
 * Offline referral demo (installable PWA, fully mocked, no Frak backend).
 * Unhashed files stay revalidated so a deploy reaches installed copies.
 */
export const referralDemoWebsite = new sst.aws.StaticSite("ReferralDemo", {
    path: "example/referral-demo",
    domain: {
        name: "referral-demo.frak-labs.com",
    },
    build: {
        command: "bun run build",
        output: "dist",
    },
    assets: {
        fileOptions: [
            {
                files: "**",
                cacheControl: "max-age=31536000,public,immutable",
            },
            {
                files: [
                    "**/*.html",
                    "sw.js",
                    "manifest.webmanifest",
                    "fonts/*",
                    "icons/*",
                ],
                cacheControl: "max-age=0,no-cache,no-store,must-revalidate",
            },
        ],
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
    environment: {
        STAGE: normalizedStageName,
        FRAK_WALLET_URL: walletUrl,
    },
    dev: { autostart: false },
});
