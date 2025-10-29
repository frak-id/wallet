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

export const frakWalletSdkConfig: Omit<FrakWalletSdkConfig, "domain"> = {
    walletUrl: getWalletUrl(),
    metadata: {
        name: "Dashboard",
    },
    customizations: {
        css: isRunningLocally
            ? "https://localhost:3001/css/nexus-modals.css"
            : "https://business-dev.frak.id/css/nexus-modals.css",
    },
};
