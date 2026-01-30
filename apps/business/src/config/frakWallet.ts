import { isRunningLocally } from "@frak-labs/app-essentials";
import type { FrakWalletSdkConfig } from "@frak-labs/core-sdk";

/**
 * Get the wallet URL based on environment
 * Falls back to local wallet if running locally
 */
function getWalletUrl(): string {
    if (process.env.FRAK_WALLET_URL) {
        return process.env.FRAK_WALLET_URL;
    }

    // Fallback based on environment
    if (isRunningLocally) {
        return "https://localhost:3000";
    }

    // Default to production wallet
    return "https://wallet.frak.id";
}

/**
 * Get the CSS URL for nexus modals based on environment
 * Uses runtime hostname check when available, falls back to environment variables
 */
function getCssUrl(): `${string}.css` {
    // First check: if running locally (STAGE not set or not a known stage), use localhost
    if (isRunningLocally) {
        return "http://localhost:3022/css/nexus-modals.css";
    }

    // Runtime check: if we're in the browser and NOT running locally, use the current origin
    if (typeof window !== "undefined" && window.location) {
        const origin = window.location.origin;
        // If we're on a frak.id domain, use that origin
        if (origin.includes("frak.id")) {
            return `${origin}/css/nexus-modals.css` as `${string}.css`;
        }
        // If we're on localhost but isRunningLocally is false, this might be a test environment
        // Fall through to environment-based detection
    }

    // Build-time/server-side: check environment
    // Determine the business URL based on environment
    // Check if we're in production
    const isProd =
        process.env.STAGE === "prod" || process.env.STAGE === "production";

    if (isProd) {
        return "https://business.frak.id/css/nexus-modals.css";
    }

    // Default to dev environment
    return "https://business-dev.frak.id/css/nexus-modals.css";
}

export const frakWalletSdkConfig: Omit<FrakWalletSdkConfig, "domain"> = {
    walletUrl: getWalletUrl(),
    metadata: {
        name: "Dashboard",
    },
    customizations: {
        css: getCssUrl(),
    },
};
