import { FrakRpcError, RpcErrorCodes } from "@frak-labs/frame-connector";
import type { Address } from "viem";
import type {
    DisplayEmbeddedWalletParamsType,
    FrakClient,
    FrakContext,
    FrakContextV1,
    FrakContextV2,
    WalletStatusReturnType,
} from "../../types";
import { FrakContextManager, getClientId, trackEvent } from "../../utils";
import { displayEmbeddedWallet } from "../displayEmbeddedWallet";
import { sendInteraction } from "../sendInteraction";

export type ProcessReferralOptions = {
    alwaysAppendUrl?: boolean;
};

type ReferralState =
    | "idle"
    | "processing"
    | "success"
    | "no-wallet"
    | "error"
    | "no-referrer";

function isV1Context(ctx: FrakContext): ctx is FrakContextV1 {
    return "r" in ctx && !("v" in ctx);
}

function isV2Context(ctx: FrakContext): ctx is FrakContextV2 {
    return "v" in ctx && ctx.v === 2;
}

function trackArrivalFromContext(
    client: FrakClient,
    frakContext: FrakContext,
    walletStatus?: WalletStatusReturnType
): boolean {
    const landingUrl =
        typeof window !== "undefined" ? window.location.href : undefined;

    if (isV2Context(frakContext)) {
        trackEvent(client, "user_referred_started", {
            properties: {
                referrerClientId: frakContext.c,
                walletStatus: walletStatus?.key,
            },
        });
        sendInteraction(client, {
            type: "arrival",
            referrerClientId: frakContext.c,
            referrerMerchantId: frakContext.m,
            landingUrl,
        });
        return true;
    }

    if (isV1Context(frakContext)) {
        trackEvent(client, "user_referred_started", {
            properties: {
                referrer: frakContext.r,
                walletStatus: walletStatus?.key,
            },
        });
        sendInteraction(client, {
            type: "arrival",
            referrerWallet: frakContext.r,
            landingUrl,
        });
        return true;
    }

    return false;
}

function buildCurrentUserContext(merchantId?: string): FrakContextV2 | null {
    const clientId = getClientId();
    if (!clientId) return null;
    return {
        v: 2,
        c: clientId,
        m: merchantId ?? "",
        t: Math.floor(Date.now() / 1000),
    };
}

export async function processReferral(
    client: FrakClient,
    {
        walletStatus,
        frakContext,
        modalConfig,
        options,
    }: {
        walletStatus?: WalletStatusReturnType;
        frakContext?: FrakContext | null;
        modalConfig?: DisplayEmbeddedWalletParamsType;
        options?: ProcessReferralOptions;
    }
) {
    if (!frakContext) {
        return "no-referrer";
    }

    if (!trackArrivalFromContext(client, frakContext, walletStatus)) {
        return "no-referrer";
    }

    const contextMerchantId = isV2Context(frakContext)
        ? frakContext.m
        : undefined;

    try {
        const currentWallet = await ensureWalletIfNeeded(client, {
            modalConfig,
            walletStatus,
        });

        const replaceContext = options?.alwaysAppendUrl
            ? buildCurrentUserContext(contextMerchantId)
            : null;

        FrakContextManager.replaceUrl({
            url: window.location?.href,
            context: replaceContext,
        });

        trackEvent(client, "user_referred_completed", {
            properties: {
                status: "success",
                wallet: currentWallet,
            },
        });

        return "success" as const;
    } catch (error) {
        console.log("Error processing referral", { error });

        trackEvent(client, "user_referred_error", {
            properties: {
                error:
                    error instanceof FrakRpcError
                        ? `[${error.code}] ${error.name} - ${error.message}`
                        : error instanceof Error
                          ? error.message
                          : "undefined",
            },
        });

        FrakContextManager.replaceUrl({
            url: window.location?.href,
            context: options?.alwaysAppendUrl
                ? buildCurrentUserContext(contextMerchantId)
                : null,
        });

        return mapErrorToState(error);
    }
}

async function ensureWalletIfNeeded(
    client: FrakClient,
    {
        modalConfig,
        walletStatus,
    }: {
        modalConfig?: DisplayEmbeddedWalletParamsType;
        walletStatus?: WalletStatusReturnType;
    }
): Promise<Address | undefined> {
    if (walletStatus?.key === "connected") {
        return walletStatus.wallet ?? undefined;
    }

    if (modalConfig) {
        const result = await displayEmbeddedWallet(client, {
            ...modalConfig,
            loggedIn: {
                action: {
                    key: "referred",
                },
            },
        });
        return result?.wallet ?? undefined;
    }

    return undefined;
}

function mapErrorToState(error: unknown): ReferralState {
    if (error instanceof FrakRpcError) {
        switch (error.code) {
            case RpcErrorCodes.walletNotConnected:
                return "no-wallet";
            default:
                return "error";
        }
    }
    return "error";
}
