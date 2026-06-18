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
        i18n: {
            fr: {
                "sdk.modal.login.title": "Connectez-vous à votre compte Frak",
                "sdk.modal.login.description":
                    "Accédez à votre dashboard et suivez vos gains en temps réel.",
                "sdk.modal.siweAuthenticate.title":
                    "Connectez-vous à votre compte Frak",
                "sdk.modal.siweAuthenticate.description":
                    "Accédez à votre dashboard et suivez vos gains en temps réel.",
            },
            en: {
                "sdk.modal.login.title": "Log in to your Frak account",
                "sdk.modal.login.description":
                    "Access your dashboard and track your earnings in real time.",
                "sdk.modal.siweAuthenticate.title":
                    "Log in to your Frak account",
                "sdk.modal.siweAuthenticate.description":
                    "Access your dashboard and track your earnings in real time.",
            },
        },
    },
    preload: ["modal"],
};
