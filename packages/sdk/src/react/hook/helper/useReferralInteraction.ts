import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import type { Hex } from "viem";
import { isAddressEqual } from "viem";
import type {
    DisplayModalParamsType,
    ModalStepTypes,
    WalletStatusReturnType,
} from "../../../core";
import { FrakRpcError, RpcErrorCodes } from "../../../core";
import { ReferralInteractionEncoder } from "../../../core/interactions";
import { useDisplayModal } from "../useDisplayModal";
import { useSendInteraction } from "../useSendInteraction";
import { useWalletStatus } from "../useWalletStatus";
import { useNexusContext } from "../utils/useNexusContext";

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
 * Helper hook to automatically submit a referral interaction when detected
 *   -> And automatically set the referral context in the url
 * @param contentId
 * @param modalConfig
 */
export function useReferralInteraction({
    contentId,
    modalConfig,
}: {
    contentId?: Hex;
    modalConfig?: DisplayModalParamsType<ModalStepTypes[]>;
} = {}) {
    // Get the current nexus context
    const { nexusContext, updateContextAsync } = useNexusContext();

    // Get the wallet status
    const { data: walletStatus } = useWalletStatus();

    // Hook to send an interaction
    const { mutateAsync: sendInteraction } = useSendInteraction();

    // Helper to display a modal if needed
    const ensureWalletConnected = useEnsureWalletConnected({
        modalConfig,
        walletStatus,
    });

    // Function to process the referral
    const processReferral = useCallback(async (): Promise<ReferralState> => {
        try {
            // Get the current wallet, without auto displaying the modal
            let currentWallet = await ensureWalletConnected({
                autoDisplay: false,
            });

            if (!nexusContext?.r) {
                if (currentWallet) {
                    await updateContextAsync({ r: currentWallet });
                }
                return "no-referrer";
            }

            // We have a referral, so if we don't have a current wallet, display the modal
            if (!currentWallet) {
                currentWallet = await ensureWalletConnected({
                    autoDisplay: true,
                });
            }

            if (
                currentWallet &&
                isAddressEqual(nexusContext.r, currentWallet)
            ) {
                return "self-referral";
            }

            const interaction = ReferralInteractionEncoder.referred({
                referrer: nexusContext.r,
            });

            await sendInteraction({ contentId, interaction });

            if (currentWallet) {
                await updateContextAsync({ r: currentWallet });
            }
            return "success";
        } catch (error) {
            return mapErrorToState(error);
        }
    }, [
        nexusContext,
        contentId,
        ensureWalletConnected,
        sendInteraction,
        updateContextAsync,
    ]);

    // Setup the query that will transmit the referral interaction
    const {
        data: referralState,
        error,
        status,
    } = useQuery({
        gcTime: 0,
        staleTime: 0,
        queryKey: [
            "nexus-sdk",
            "auto-referral-interaction",
            nexusContext?.r ?? "no-referrer",
            walletStatus?.key ?? "no-wallet-status",
        ],
        queryFn: processReferral,
        enabled: !!walletStatus,
    });

    return useMemo(() => {
        if (status === "pending") return "processing";
        if (status === "error") return mapErrorToState(error);
        return referralState || "idle";
    }, [referralState, status, error]);
}

/**
 * Helper to ensure a wallet is connected, and display a modal if we got everything needed
 */
function useEnsureWalletConnected({
    modalConfig,
    walletStatus,
}: {
    modalConfig?: DisplayModalParamsType<ModalStepTypes[]>;
    walletStatus?: WalletStatusReturnType;
}) {
    // Hook to display the modal
    const { mutateAsync: displayModal } = useDisplayModal();

    return useCallback(
        async ({ autoDisplay }: { autoDisplay: boolean }) => {
            // If wallet not connected, or no interaction session
            if (
                walletStatus?.key !== "connected" ||
                !walletStatus.interactionSession
            ) {
                // If we don't have any modal setup, or we don't want to auto display it, do nothing
                if (!(modalConfig && autoDisplay)) {
                    return undefined;
                }
                const result = await displayModal(modalConfig);
                return result?.login?.wallet ?? undefined;
            }

            return walletStatus.wallet ?? undefined;
        },
        [walletStatus, modalConfig, displayModal]
    );
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
            case RpcErrorCodes.noInteractionSession:
                return "no-session";
            default:
                return "error";
        }
    }
    return "error";
}
