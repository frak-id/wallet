import { type Address, type Hex, isAddressEqual } from "viem";
import { ReferralInteractionEncoder } from "../../interactions";
import {
    type DisplayEmbededWalletParamsType,
    type FrakClient,
    type FrakContext,
    FrakRpcError,
    RpcErrorCodes,
    type WalletStatusReturnType,
} from "../../types";
import { FrakContextManager } from "../../utils";
import { displayEmbededWallet, sendInteraction } from "../index";

/**
 * The different states of the referral process
 * @inline
 */
type ReferralState =
    | "idle"
    | "processing"
    | "success"
    | "no-wallet"
    | "no-session"
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
 *  4. Check if the user has an interaction session or not
 *  4.1 If not, display a modal for the user to open a session
 *  5. Push the referred interaction
 *  6. Update the current url with the right data
 *  7. Return the resulting referral state
 *
 *  If any error occurs during the process, the function will catch it and return an error state
 *
 * @param client - The current Frak Client
 * @param args
 * @param args.walletStatus - The current user wallet status
 * @param args.frakContext - The current frak context
 * @param args.modalConfig - The modal configuration to display if the user is not logged in
 * @param args.productId - The product id to interact with (if not specified will be recomputed from the current domain)
 * @param args.options - Some options for the referral interaction
 * @returns  A promise with the resulting referral state
 *
 * @see {@link displayModal} for more details about the displayed modal
 * @see {@link sendInteraction} for more details on the interaction submission part
 * @see {@link ReferralInteractionEncoder} for more details about the referred interaction
 * @see {@link ModalStepTypes} for more details on each modal steps types
 */
export async function processReferral(
    client: FrakClient,
    {
        walletStatus,
        frakContext,
        modalConfig,
        productId,
        options,
    }: {
        walletStatus?: WalletStatusReturnType;
        frakContext?: Partial<FrakContext> | null;
        modalConfig?: DisplayEmbededWalletParamsType;
        productId?: Hex;
        options?: ProcessReferralOptions;
    }
) {
    // Helper to fetch a fresh wallet status
    let walletRequest = false;
    async function getFreshWalletStatus() {
        if (walletRequest) {
            return;
        }
        walletRequest = true;
        return ensureWalletConnected(client, {
            modalConfig,
            walletStatus,
        });
    }

    // Helper function to push the interaction
    async function pushReferralInteraction(referrer: Address) {
        const interaction = ReferralInteractionEncoder.referred({
            referrer,
        });
        await sendInteraction(client, { productId, interaction });
    }

    try {
        // Do the core processing logic
        const { status, currentWallet } = await processReferralLogic({
            initialWalletStatus: walletStatus,
            getFreshWalletStatus,
            pushReferralInteraction,
            frakContext,
        });

        // Update the current url with the right data
        FrakContextManager.replaceUrl({
            url: window.location?.href,
            context: options?.alwaysAppendUrl ? { r: currentWallet } : null,
        });

        return status;
    } catch (error) {
        console.log("Error processing referral", { error });
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
 * Automatically submit a referral interaction when detected
 *   -> And automatically set the referral context in the url
 * @param walletStatus
 * @param frakContext
 */
async function processReferralLogic({
    initialWalletStatus,
    getFreshWalletStatus,
    pushReferralInteraction,
    frakContext,
}: {
    initialWalletStatus?: WalletStatusReturnType;
    getFreshWalletStatus: () => Promise<Address | undefined>;
    pushReferralInteraction: (referrer: Address) => Promise<void>;
    frakContext?: Partial<FrakContext> | null;
}) {
    // Get the current wallet, without auto displaying the modal
    let currentWallet = initialWalletStatus?.wallet;
    if (!frakContext?.r) {
        return { status: "no-referrer", currentWallet } as const;
    }

    // We have a referral, so if we don't have a current wallet, display the modal
    if (!currentWallet) {
        currentWallet = await getFreshWalletStatus();
    }

    if (currentWallet && isAddressEqual(frakContext.r, currentWallet)) {
        return { status: "self-referral", currentWallet } as const;
    }

    // If the current wallet doesn't have an interaction session, display the modal
    if (!initialWalletStatus?.interactionSession) {
        currentWallet = await getFreshWalletStatus();
    }

    // Push the referred interaction
    await pushReferralInteraction(frakContext.r);
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
        modalConfig?: DisplayEmbededWalletParamsType;
        walletStatus?: WalletStatusReturnType;
    }
) {
    // If wallet not connected, or no interaction session
    if (!walletStatus?.interactionSession) {
        // If we don't have any modal setup, or we don't want to auto display it, do nothing
        if (!modalConfig) {
            return undefined;
        }
        const result = await displayEmbededWallet(client, modalConfig);
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
            case RpcErrorCodes.serverErrorForInteractionDelegation:
                return "no-session";
            default:
                return "error";
        }
    }
    return "error";
}
