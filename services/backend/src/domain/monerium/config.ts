import { log } from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import { isRunningInProd } from "@frak-labs/app-essentials";
import { moneriumErrorCodes } from "./schemas";

export type MoneriumChain = "arbitrum" | "arbitrumsepolia";

export type MoneriumConfig = {
    clientId: string;
    environment: "sandbox" | "production";
    apiBaseUrl: string;
    chain: MoneriumChain;
    chainId: number;
    walletUrl: string;
    redirectUri: string;
    siweDomain: string;
    /** Must equal the application name registered at Monerium for this client id. */
    siweAppName: string;
};

type MoneriumEnv = Record<string, string | undefined>;

/** Null when the client id, the app name or the wallet URL is missing or unusable. */
export function readMoneriumConfig(
    env: MoneriumEnv,
    production: boolean
): MoneriumConfig | null {
    const clientId = env.MONERIUM_CLIENT_ID?.trim();
    const rawWalletUrl = env.FRAK_WALLET_URL?.trim();
    const siweAppName = env.MONERIUM_APP_NAME?.trim();
    if (!clientId || !rawWalletUrl || !siweAppName) return null;

    const walletUrl = rawWalletUrl.replace(/\/+$/, "");
    let siweDomain: string;
    try {
        siweDomain = new URL(walletUrl).host;
    } catch {
        return null;
    }

    return {
        clientId,
        environment: production ? "production" : "sandbox",
        apiBaseUrl: production
            ? "https://api.monerium.app"
            : "https://api.monerium.dev",
        chain: production ? "arbitrum" : "arbitrumsepolia",
        chainId: production ? 42161 : 421614,
        walletUrl,
        redirectUri: `${walletUrl}/monerium/callback`,
        siweDomain,
        siweAppName,
    };
}

let missingConfigLogged = false;

/** Resolved per call so a missing secret degrades to a 502 instead of failing the boot. */
export function requireMoneriumConfig(): MoneriumConfig {
    const config = readMoneriumConfig(process.env, isRunningInProd);
    if (config) return config;

    if (!missingConfigLogged) {
        missingConfigLogged = true;
        log.error(
            "[Monerium] MONERIUM_CLIENT_ID, MONERIUM_APP_NAME or FRAK_WALLET_URL is missing, Monerium routes answer 502"
        );
    }
    throw HttpError.badGateway(
        moneriumErrorCodes.upstreamUnavailable,
        "Monerium is not available right now"
    );
}
