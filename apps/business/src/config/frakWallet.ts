import { isRunningLocally } from "@frak-labs/app-essentials";
import type { FrakEnvironment, FrakWalletSdkConfig } from "@frak-labs/core-sdk";

/** The stage the dashboard's own SDK talks to; reused verbatim since this app deploys against sandboxes no preset covers. */
function getEnv(): FrakEnvironment {
    if (process.env.FRAK_WALLET_URL && process.env.BACKEND_URL) {
        return {
            wallet: process.env.FRAK_WALLET_URL,
            backend: process.env.BACKEND_URL,
        };
    }

    // Half-injected is a deploy bug: falling through would point widgets at production while the API client uses the injected stage.
    if (process.env.FRAK_WALLET_URL || process.env.BACKEND_URL) {
        console.error(
            "[Frak] FRAK_WALLET_URL and BACKEND_URL must be injected together; ignoring both."
        );
    }

    if (isRunningLocally) {
        return {
            wallet: "https://localhost:3000",
            backend: "https://localhost:3030",
        };
    }

    return "prod";
}

export const frakWalletSdkConfig: Omit<FrakWalletSdkConfig, "domain"> = {
    env: getEnv(),
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
