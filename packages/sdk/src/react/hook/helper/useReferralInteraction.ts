import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { Hex } from "viem";
import type { DisplayModalParamsType, ModalStepTypes } from "../../../core";
import { processReferral } from "../../../core/interactions";
import { ClientNotFound } from "../../../core/types/rpc/error";
import { useNexusClient } from "../useNexusClient";
import { useWalletStatus } from "../useWalletStatus";
import { useNexusContext } from "../utils/useNexusContext";

/**
 * Helper hook to automatically submit a referral interaction when detected
 *   -> And automatically set the referral context in the url
 * @param productId
 * @param modalConfig
 */
export function useReferralInteraction({
    productId,
    modalConfig,
}: {
    productId?: Hex;
    modalConfig?: DisplayModalParamsType<ModalStepTypes[]>;
} = {}) {
    // Get the nexus client
    const client = useNexusClient();

    // Get the current nexus context
    const { nexusContext } = useNexusContext();

    // Get the wallet status
    const { data: walletStatus } = useWalletStatus();

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
            productId ?? "no-product-id",
        ],
        queryFn: () => {
            if (!client) {
                throw new ClientNotFound();
            }

            return processReferral(client, {
                walletStatus,
                nexusContext,
                modalConfig,
                productId,
            });
        },
        enabled: !!walletStatus,
    });

    return useMemo(() => {
        if (status === "pending") return "processing";
        if (status === "error") return error;
        return referralState || "idle";
    }, [referralState, status, error]);
}
