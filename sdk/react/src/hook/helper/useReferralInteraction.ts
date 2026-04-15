import {
    type ProcessReferralOptions,
    referralInteraction,
} from "@frak-labs/core-sdk/actions";
import { ClientNotFound } from "@frak-labs/frame-connector";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useFrakClient } from "../useFrakClient";

/**
 * Helper hook to automatically submit a referral interaction when detected
 *
 * Runs once when the Frak client becomes available.
 *
 * @group hooks
 *
 * @param args
 * @param args.options - Some options for the referral interaction
 *
 * @returns  The resulting referral state, or a potential error
 *
 * @description This function will automatically handle the referral interaction process
 *
 * @see {@link @frak-labs/core-sdk!actions.referralInteraction | `referralInteraction()`} for more details on the automatic referral handling process
 */
export function useReferralInteraction({
    options,
}: {
    options?: ProcessReferralOptions;
} = {}) {
    const client = useFrakClient();

    const {
        data: referralState,
        error,
        status,
    } = useQuery({
        queryKey: ["frak-sdk", "auto-referral-interaction"],
        queryFn: async () => {
            if (!client) {
                throw new ClientNotFound();
            }

            return referralInteraction(client, { options });
        },
        enabled: !!client,
        staleTime: Number.POSITIVE_INFINITY,
    });

    return useMemo(() => {
        if (status === "pending") return "processing";
        if (status === "error") return error;
        return referralState || "idle";
    }, [referralState, status, error]);
}
