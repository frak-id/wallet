import { FrakRpcError, RpcErrorCodes } from "@frak-labs/frame-connector";
import { type Address, isAddressEqual } from "viem";
import type {
    DisplayEmbeddedWalletParamsType,
    FrakClient,
    FrakContext,
    WalletStatusReturnType,
} from "../../types";
import { extractUtmParams, FrakContextManager, trackEvent } from "../../utils";
import { displayEmbeddedWallet } from "../displayEmbeddedWallet";
import { sendInteraction } from "../sendInteraction";

/**
 * The different states of the referral process
 * @inline
 */
type ReferralState =
    | "idle"
    | "processing"
    | "success"
    | "no-wallet"
    | "error"
    | "no-referrer"
    | "self-referral";

/**
 * Options for the referral auto-interaction process
 */
export type ProcessReferralOptions = {
    /**
     * If we want to always append the url with the frak context or not
     * @defaultValue false
     */
    alwaysAppendUrl?: boolean;
};

/**
 * This function handle all the heavy lifting of the referral interaction process
 *  1. Check if the user has been referred or not (if not, early exit)
 *  2. Then check if the user is logged in or not
 *  2.1 If not logged in, try a soft login, if it fail, display a modal for the user to login
 *  3. Check if that's not a self-referral (if yes, early exit)
 *  4. Track the referral event
 *  5. Update the current url with the right data
 *  6. Return the resulting referral state
 *
 *  If any error occurs during the process, the function will catch it and return an error state
 *
 * @param client - The current Frak Client
 * @param args
 * @param args.walletStatus - The current user wallet status
 * @param args.frakContext - The current frak context
 * @param args.modalConfig - The modal configuration to display if the user is not logged in
 * @param args.options - Some options for the referral interaction
 * @returns  A promise with the resulting referral state
 *
 * @see {@link displayModal} for more details about the displayed modal
 * @see {@link @frak-labs/core-sdk!ModalStepTypes} for more details on each modal steps types
 */
export async function processReferral(
    client: FrakClient,
    {
        walletStatus,
        frakContext,
        modalConfig,
        options,
    }: {
        walletStatus?: WalletStatusReturnType;
        frakContext?: Partial<FrakContext> | null;
        modalConfig?: DisplayEmbeddedWalletParamsType;
        options?: ProcessReferralOptions;
    }
) {
    // Early exit if we don't have any referral informations
    if (!frakContext?.r) {
        return "no-referrer";
    }

    // If we got a context, log an event
    trackEvent(client, "user_referred_started", {
        properties: {
            referrer: frakContext?.r,
            walletStatus: walletStatus?.key,
        },
    });

    // Send arrival interaction immediately via RPC (fire-and-forget)
    // This happens BEFORE wallet check to capture anonymous arrivals via clientId
    const utmParams = extractUtmParams();
    sendInteraction(client, {
        type: "arrival",
        referrerWallet: frakContext.r,
        landingUrl:
            typeof window !== "undefined" ? window.location.href : undefined,
        utmSource: utmParams?.source,
        utmMedium: utmParams?.medium,
        utmCampaign: utmParams?.campaign,
        utmTerm: utmParams?.term,
        utmContent: utmParams?.content,
    });

    // Helper to fetch a fresh wallet status
    let walletRequest = false;
    async function getFreshWalletStatus() {
        if (walletRequest) {
            return;
        }
        walletRequest = true;
        return ensureWalletConnected(client, {
            modalConfig: {
                ...modalConfig,
                loggedIn: {
                    action: {
                        key: "referred",
                    },
                },
            },
            walletStatus,
        });
    }

    try {
        // Do the core processing logic
        const { status, currentWallet } = await processReferralLogic({
            initialWalletStatus: walletStatus,
            getFreshWalletStatus,
            // We can enforce this type cause of the condition at the start
            frakContext: frakContext as Pick<FrakContext, "r">,
        });

        // Update the current url with the right data
        FrakContextManager.replaceUrl({
            url: window.location?.href,
            context: options?.alwaysAppendUrl ? { r: currentWallet } : null,
        });

        // Track the event
        trackEvent(client, "user_referred_completed", {
            properties: {
                status,
                referrer: frakContext?.r,
                wallet: currentWallet,
            },
        });

        return status;
    } catch (error) {
        console.log("Error processing referral", { error });

        // Track the error event
        trackEvent(client, "user_referred_error", {
            properties: {
                referrer: frakContext?.r,
                error:
                    error instanceof FrakRpcError
                        ? `[${error.code}] ${error.name} - ${error.message}`
                        : error instanceof Error
                          ? error.message
                          : "undefined",
            },
        });

        // Update the current url with the right data
        FrakContextManager.replaceUrl({
            url: window.location?.href,
            context: options?.alwaysAppendUrl
                ? { r: walletStatus?.wallet }
                : null,
        });

        // And map the error a state
        return mapErrorToState(error);
    }
}

/**
 * Process referral logic - ensure user is logged in and check for self-referral
 */
async function processReferralLogic({
    initialWalletStatus,
    getFreshWalletStatus,
    frakContext,
}: {
    initialWalletStatus?: WalletStatusReturnType;
    getFreshWalletStatus: () => Promise<Address | undefined>;
    frakContext: Pick<FrakContext, "r">;
}) {
    // Get the current wallet, without auto displaying the modal
    let currentWallet = initialWalletStatus?.wallet;

    // If we don't have a current wallet, display the modal to log in
    if (!currentWallet) {
        currentWallet = await getFreshWalletStatus();
    }

    // Check for self-referral
    if (currentWallet && isAddressEqual(frakContext.r, currentWallet)) {
        return { status: "self-referral", currentWallet } as const;
    }

    return { status: "success", currentWallet } as const;
}

/**
 * Helper to ensure a wallet is connected, and display a modal if we got everything needed
 */
async function ensureWalletConnected(
    client: FrakClient,
    {
        modalConfig,
        walletStatus,
    }: {
        modalConfig?: DisplayEmbeddedWalletParamsType;
        walletStatus?: WalletStatusReturnType;
    }
) {
    // If wallet not connected, display modal
    if (walletStatus?.key !== "connected") {
        const result = await displayEmbeddedWallet(client, modalConfig ?? {});
        return result?.wallet ?? undefined;
    }

    return walletStatus.wallet ?? undefined;
}

/**
 * Helper to map an error to a state
 * @param error
 */
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
