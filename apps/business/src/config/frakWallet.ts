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
                "sdk.modal.login.title": "Connectez-vous ou créez votre compte",
                "sdk.modal.login.description":
                    "Nouveau ici ? Nous créons votre compte. Vous en avez déjà un ? Vous le retrouvez. Il vous sert à gérer vos campagnes et vos récompenses.",
                "sdk.modal.login.primaryAction": "Continuer",
                "sdk.modal.siweAuthenticate.title": "Confirmez que c'est vous",
                "sdk.modal.siweAuthenticate.description":
                    "Confirmez avec votre compte Frak pour continuer.",
                "sdk.modal.siweAuthenticate.primaryAction": "Confirmer",
            },
            en: {
                "sdk.modal.login.title": "Log in or create your account",
                "sdk.modal.login.description":
                    "New here? We create your account. Already have one? You get your account back. Use it to manage your campaigns and rewards.",
                "sdk.modal.login.primaryAction": "Continue",
                "sdk.modal.siweAuthenticate.title": "Confirm it's you",
                "sdk.modal.siweAuthenticate.description":
                    "Confirm with your Frak account to continue.",
                "sdk.modal.siweAuthenticate.primaryAction": "Confirm",
            },
        },
    },
    preload: ["modal"],
};
