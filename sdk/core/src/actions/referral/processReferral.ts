import { isAddressEqual } from "viem";
import type {
    FrakClient,
    FrakContext,
    FrakContextV2,
    WalletStatusReturnType,
} from "../../types";
import { isV1Context, isV2Context } from "../../types";
import { FrakContextManager, getClientId, trackEvent } from "../../utils";
import { sendInteraction } from "../sendInteraction";

/**
 * Options for the referral auto-interaction process.
 */
export type ProcessReferralOptions = {
    /**
     * If true, always replace the URL with the current user's referral context
     * so the next visitor gets referred by this user.
     * @defaultValue false
     */
    alwaysAppendUrl?: boolean;
    /**
     * Merchant ID for building the current user's referral context.
     * Required when `alwaysAppendUrl` is true and the incoming context is V1.
     * For V2 contexts, the merchantId is already embedded in the context.
     */
    merchantId?: string;
};

/**
 * The different states of the referral process.
 * @inline
 */
type ReferralState =
    | "idle"
    | "processing"
    | "success"
    | "no-referrer"
    | "self-referral";

/**
 * Track an arrival event if the context version is recognized.
 * Sends both tracking analytics and the arrival interaction RPC.
 *
 * @returns true if the context was valid and tracked, false otherwise
 */
function trackArrivalIfValid(
    client: FrakClient,
    frakContext: FrakContext,
    walletStatus?: WalletStatusReturnType
): boolean {
    const landingUrl =
        typeof window !== "undefined" ? window.location.href : undefined;

    if (isV2Context(frakContext)) {
        trackEvent(client, "user_referred_started", {
            referrerClientId: frakContext.c,
            referrerWallet: frakContext.w,
            walletStatus: walletStatus?.key,
        });
        sendInteraction(client, {
            type: "arrival",
            referrerClientId: frakContext.c,
            referrerMerchantId: frakContext.m,
            referrerWallet: frakContext.w,
            referralTimestamp: frakContext.t,
            landingUrl,
        });
        return true;
    }

    if (isV1Context(frakContext)) {
        trackEvent(client, "user_referred_started", {
            referrer: frakContext.r,
            walletStatus: walletStatus?.key,
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

/**
 * Build a V2 context representing the current user for URL replacement.
 *
 * Emits both `c` (anonymous clientId) and `w` (wallet) when available — wallet
 * is the preferred identity signal and takes attribution precedence downstream.
 * Returns null when neither identifier is available.
 */
function buildCurrentUserContext(
    merchantId: string,
    wallet?: WalletStatusReturnType["wallet"]
): FrakContextV2 | null {
    const clientId = getClientId();
    if (!clientId && !wallet) return null;
    return {
        v: 2,
        m: merchantId,
        t: Math.floor(Date.now() / 1000),
        ...(clientId ? { c: clientId } : {}),
        ...(wallet ? { w: wallet } : {}),
    };
}

/**
 * Client-side self-referral preflight check.
 * Prevents unnecessary backend round-trips for obvious self-referrals.
 */
function isSelfReferral(
    frakContext: FrakContext,
    walletStatus?: WalletStatusReturnType
): boolean {
    if (isV2Context(frakContext)) {
        // Wallet match takes precedence — it's the strongest signal we have.
        if (frakContext.w && walletStatus?.wallet) {
            return isAddressEqual(frakContext.w, walletStatus.wallet);
        }
        if (frakContext.c) {
            return getClientId() === frakContext.c;
        }
        return false;
    }
    if (isV1Context(frakContext) && walletStatus?.wallet) {
        return isAddressEqual(frakContext.r, walletStatus.wallet);
    }
    return false;
}

/**
 * Handle the full referral interaction flow:
 *
 *  1. Check if the user has been referred (if not, early exit)
 *  2. Preflight self-referral check (if yes, early exit)
 *  3. Track the arrival event
 *  4. Replace the current URL with the user's own referral context
 *  5. Return the resulting referral state
 *
 * @param client - The current Frak Client
 * @param args
 * @param args.walletStatus - The current user wallet status
 * @param args.frakContext - The referral context parsed from the URL
 * @param args.options - Options for URL replacement and merchant context
 * @returns The referral state
 *
 * @see {@link @frak-labs/core-sdk!ModalStepTypes} for modal step types
 */
export function processReferral(
    client: FrakClient,
    {
        walletStatus,
        frakContext,
        options,
    }: {
        walletStatus?: WalletStatusReturnType;
        frakContext?: FrakContext | null;
        options?: ProcessReferralOptions;
    }
): ReferralState {
    if (!frakContext) {
        return "no-referrer";
    }

    if (isSelfReferral(frakContext, walletStatus)) {
        return "self-referral";
    }

    if (!trackArrivalIfValid(client, frakContext, walletStatus)) {
        return "no-referrer";
    }

    // V2 context embeds merchantId; V1 falls back to options
    const contextMerchantId = isV2Context(frakContext)
        ? frakContext.m
        : options?.merchantId;

    const replaceContext =
        options?.alwaysAppendUrl && contextMerchantId
            ? buildCurrentUserContext(contextMerchantId, walletStatus?.wallet)
            : null;

    FrakContextManager.replaceUrl({
        url: window.location?.href,
        context: replaceContext,
    });

    trackEvent(client, "user_referred_completed", {
        status: "success",
    });

    return "success";
}
