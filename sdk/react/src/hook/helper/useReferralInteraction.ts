import {
    ClientNotFound,
    type DisplayModalParamsType,
    type ModalStepTypes,
} from "@frak-labs/core-sdk";
import {
    type ProcessReferralOptions,
    processReferral,
} from "@frak-labs/core-sdk/actions";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { Hex } from "viem";
import { useFrakClient } from "../useFrakClient";
import { useWalletStatus } from "../useWalletStatus";
import { useFrakContext } from "../utils/useFrakContext";

/**
 * Helper hook to automatically submit a referral interaction when detected
 *
 * @group hooks
 *
 * @param args
 * @param args.productId - The product id to interact with (if not specified will be recomputed from the current domain)
 * @param modalConfig - The modal configuration to display if the user is not logged in
 * @param options - Some options for the referral interaction
 *
 * @returns  The resulting referral state, or a potential error
 *
 * @description This function will automatically handle the referral interaction process
 *
 * @see {@link processReferral} for more details on the automatic referral handling process
 */
export function useReferralInteraction({
    productId,
    modalConfig,
    options,
}: {
    productId?: Hex;
    modalConfig?: DisplayModalParamsType<ModalStepTypes[]>;
    options?: ProcessReferralOptions;
} = {}) {
    // Get the nexus client
    const client = useFrakClient();

    // Get the current frak context
    const { frakContext } = useFrakContext();

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
            "frak-sdk",
            "auto-referral-interaction",
            frakContext?.r ?? "no-referrer",
            walletStatus?.key ?? "no-wallet-status",
            productId ?? "no-product-id",
        ],
        queryFn: () => {
            if (!client) {
                throw new ClientNotFound();
            }

            return processReferral(client, {
                walletStatus,
                frakContext,
                modalConfig,
                productId,
                options,
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
