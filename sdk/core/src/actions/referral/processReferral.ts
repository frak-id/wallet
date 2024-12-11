import { type Address, type Hex, isAddressEqual } from "viem";
import { ReferralInteractionEncoder } from "../../interactions";
import {
    type DisplayModalParamsType,
    type FrakContext,
    FrakRpcError,
    type ModalStepTypes,
    type NexusClient,
    RpcErrorCodes,
    type WalletStatusReturnType,
} from "../../types";
import { FrakContextManager } from "../../utils";
import { displayModal, sendInteraction } from "../index";

type ReferralState =
    | "idle"
    | "processing"
    | "success"
    | "no-wallet"
    | "no-session"
    | "error"
    | "no-referrer"
    | "self-referral";

export type ProcessReferralOptions = {
    // If we want to always append the url with the frk context or not
    alwaysAppendUrl?: boolean;
};

/**
 * Automatically submit a referral interaction when detected
 *   -> And automatically set the referral context in the url
 * @param client
 * @param walletStatus
 * @param frakContext
 * @param modalConfig
 * @param productId
 * @param options
 */
export async function processReferral(
    client: NexusClient,
    {
        walletStatus,
        frakContext,
        modalConfig,
        productId,
        options,
    }: {
        walletStatus?: WalletStatusReturnType;
        frakContext?: Partial<FrakContext> | null;
        modalConfig?: DisplayModalParamsType<ModalStepTypes[]>;
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
export async function processReferralLogic({
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
    client: NexusClient,
    {
        modalConfig,
        walletStatus,
    }: {
        modalConfig?: DisplayModalParamsType<ModalStepTypes[]>;
        walletStatus?: WalletStatusReturnType;
    }
) {
    // If wallet not connected, or no interaction session
    if (!walletStatus?.interactionSession) {
        // If we don't have any modal setup, or we don't want to auto display it, do nothing
        if (!modalConfig) {
            return undefined;
        }
        const result = await displayModal(client, modalConfig);
        return result?.login?.wallet ?? undefined;
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
