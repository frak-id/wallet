import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { isAddressEqual } from "viem";
import type { Hex } from "viem";
import { FrakRpcError, RpcErrorCodes } from "../../../core";
import type { DisplayModalParamsType, ModalStepTypes } from "../../../core";
import { ReferralInteractionEncoder } from "../../../core/interactions";
import { useDisplayModal } from "../useDisplayModal";
import { useSendInteraction } from "../useSendInteraction";
import { useWalletStatus } from "../useWalletStatus";
import { useNexusContext } from "../utils/useNexusContext";

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
    const queryClient = useQueryClient();

    // Get the current nexus context
    const { nexusContext, updateContext, updateContextAsync } =
        useNexusContext();

    // Get the wallet status
    const { data: walletStatus } = useWalletStatus();

    // Hook to send an interaction
    const { mutateAsync: sendInteraction } = useSendInteraction();

    // Hook to display the modal
    const { mutate: displayModal, status: displayModalStatus } =
        useDisplayModal();

    const getQueryKey = useCallback(() => {
        return [
            "nexus-sdk",
            "auto-referral-interaction",
            nexusContext?.r ?? "no-referrer",
            walletStatus?.key ?? "no-wallet-status",
        ];
    }, [nexusContext, walletStatus]);
    const queryKey = useMemo(getQueryKey, []);

    const launchReferral = useCallback(async () => {
        if (!nexusContext) return;

        // Build the referral interaction
        const interaction = ReferralInteractionEncoder.referred({
            referrer: nexusContext.r,
        });

        // Send the interaction
        await sendInteraction({ contentId, interaction });
    }, [sendInteraction, contentId, nexusContext]);

    // Setup the query that will transmit the referral interaction
    const { data, error, status } = useQuery({
        gcTime: 0,
        staleTime: 0,
        queryKey,
        queryFn: async () => {
            // If no wallet status, directly exit
            if (!walletStatus) {
                return null;
            }

            // If no context but wallet present
            if (!nexusContext && walletStatus?.key === "connected") {
                await updateContextAsync({ r: walletStatus.wallet });
                return null;
            }
            // If no context at all, directly exit
            if (!nexusContext) {
                return null;
            }

            // If context present and same wallet as the referrer exit
            if (
                walletStatus?.key === "connected" &&
                isAddressEqual(nexusContext.r, walletStatus.wallet)
            ) {
                return null;
            }

            // If no wallet connected or no open reward session, display the modal to propose the user to connect
            if (
                walletStatus.key === "not-connected" ||
                (walletStatus.key === "connected" &&
                    !walletStatus.interactionSession)
            ) {
                modalConfig && displayModal(modalConfig);
                return null;
            }

            await launchReferral();

            return { referrer: nexusContext.r };
        },
        enabled: !!walletStatus,
    });

    /**
     * Launch the referral interaction when the modal is in success and successfully connected
     */
    useMemo(() => {
        if (displayModalStatus !== "success" || !nexusContext) return;

        launchReferral().then(() => {
            queryClient.setQueryData(queryKey, {
                referrer: nexusContext.r,
            });
        });
    }, [
        displayModalStatus,
        nexusContext,
        queryClient,
        queryKey,
        launchReferral,
    ]);

    /**
     * Update the context with the current wallet as referrer when the status is in success
     */
    useMemo(() => {
        if (walletStatus?.key === "connected" && status === "success") {
            setTimeout(() => updateContext({ r: walletStatus.wallet }), 0);
        }
    }, [walletStatus, status, updateContext]);

    // Map that to our final state
    return useOutputStateMapper({ data, error, status });
}

/**
 * Mapper for our output state
 * @param data
 * @param error
 * @param status
 */
function useOutputStateMapper({
    data,
    error,
    status,
}: {
    data?: unknown;
    error?: Error | null;
    status: "pending" | "success" | "error";
}) {
    const errorState = useMemo(() => {
        if (!error) return null;
        if (!(error instanceof FrakRpcError)) return "error";

        switch (error.code) {
            case RpcErrorCodes.walletNotConnected:
                return "no-wallet";
            case RpcErrorCodes.noInteractionSession:
                return "no-session";
            default:
                return "error";
        }
    }, [error]);

    // Map that to our final state
    return useMemo(() => {
        // First simple status
        switch (status) {
            case "pending":
                return "loading";
            case "success":
                return data === null ? "no-referral" : "referred";
            case "error":
                return errorState ?? "error";
        }
    }, [data, errorState, status]);
}
