import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { type Hex, isAddressEqual } from "viem";
import { FrakRpcError, RpcErrorCodes } from "../../../core";
import { PressInteractionEncoder } from "../../../core/interactions";
import { useSendInteraction } from "../useSendInteraction";
import { useWalletStatus } from "../useWalletStatus";
import { useNexusContext } from "../utils/useNexusContext";

/**
 * Helper hook to automatically submit a press referral interaction when detected
 *   -> And automatically set the referral context in the url
 * @param contentId
 */
export function usePressReferralInteraction({ contentId }: { contentId: Hex }) {
    // Get the current nexus context
    const { nexusContext, updateContextAsync } = useNexusContext();

    // Get the wallet status
    const { data: walletStatus } = useWalletStatus();

    // Hook to send an interaction
    const { mutateAsync: sendInteraction } = useSendInteraction();

    // Setup the query that will transmit the referral interaction
    const { data, error, status } = useQuery({
        gcTime: 0,
        queryKey: [
            "nexus-sdk",
            "auto-press-referral-interaction",
            nexusContext?.r ?? "no-referrer",
            walletStatus?.key ?? "no-wallet-status",
        ],
        queryFn: async () => {
            // If just no context but wallet present
            if (!nexusContext && walletStatus?.key === "connected") {
                await updateContextAsync({ r: walletStatus.wallet });
                return null;
            }

            // todo: If no wallet connected, but context present, send it anyway to cache it on the wallet side
            if (!nexusContext || walletStatus?.key !== "connected") return null;

            // If context and wallet present, and same referrer address, early exit
            if (isAddressEqual(nexusContext.r, walletStatus.wallet))
                return null;

            // Build the press referral interaction
            const interaction = PressInteractionEncoder.referred({
                referrer: nexusContext.r,
            });

            // Send the interaction (todo: interpret the result and return it)
            await sendInteraction({ contentId, interaction });

            // Update the context with the current wallet as referrer
            await updateContextAsync({ r: walletStatus.wallet });

            return { referrer: nexusContext.r };
        },
    });

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
        if (!(error instanceof FrakRpcError)) return null;

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