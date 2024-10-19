import { type Hex, isAddressEqual } from "viem";
import { displayModal, sendInteraction } from "../";
import type { FrakContext } from "../../../react/types/FrakContext";
import { ReferralInteractionEncoder } from "../../interactions";
import {
    type DisplayModalParamsType,
    FrakRpcError,
    type ModalStepTypes,
    type NexusClient,
    RpcErrorCodes,
    type WalletStatusReturnType,
} from "../../types";
import { FrakContextManager } from "../../utils";

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
 * Automatically submit a referral interaction when detected
 *   -> And automatically set the referral context in the url
 * @param walletStatus
 * @param frakContext
 * @param modalConfig
 * @param productId
 */
export async function processReferral(
    client: NexusClient,
    {
        walletStatus,
        frakContext,
        modalConfig,
        productId,
    }: {
        walletStatus?: WalletStatusReturnType;
        frakContext?: Partial<FrakContext> | null;
        modalConfig?: DisplayModalParamsType<ModalStepTypes[]>;
        productId?: Hex;
    }
) {
    try {
        // Get the current wallet, without auto displaying the modal
        let currentWallet = walletStatus?.wallet;
        if (!frakContext?.r) {
            if (currentWallet) {
                FrakContextManager.replaceUrl({
                    url: window.location?.href,
                    context: { r: currentWallet },
                });
            }
            return "no-referrer";
        }

        // We have a referral, so if we don't have a current wallet, display the modal
        if (!currentWallet) {
            currentWallet = await ensureWalletConnected(client, {
                modalConfig,
                walletStatus,
            });
        }

        if (currentWallet && isAddressEqual(frakContext.r, currentWallet)) {
            return "self-referral";
        }

        // If the current wallet doesn't have an interaction session, display the modal
        if (!walletStatus?.interactionSession) {
            currentWallet = await ensureWalletConnected(client, {
                modalConfig,
                walletStatus,
            });
        }

        // If we got one now, create a promise that will update the context
        if (currentWallet) {
            FrakContextManager.replaceUrl({
                url: window.location?.href,
                context: { r: currentWallet },
            });
        }

        const interaction = ReferralInteractionEncoder.referred({
            referrer: frakContext.r,
        });

        await sendInteraction(client, { productId, interaction });

        return "success";
    } catch (error) {
        return mapErrorToState(error);
    }
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
