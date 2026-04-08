import type { IFrameRpcSchema } from "@frak-labs/core-sdk";
import {
    FrakRpcError,
    RpcErrorCodes,
    type RpcPromiseHandler,
} from "@frak-labs/frame-connector";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { userReferralStatusQueryOptions } from "@/module/hooks/useUserReferralStatus";
import type { WalletRpcContext } from "@/module/types/context";

type OnGetUserReferralStatus = RpcPromiseHandler<
    IFrameRpcSchema,
    "frak_getUserReferralStatus",
    WalletRpcContext
>;

/**
 * RPC handler for `frak_getUserReferralStatus`.
 *
 * Fetches the user's referral status for the current merchant
 * via the backend `/user/merchant/referral-status` endpoint.
 */
export function useOnGetUserReferralStatus(): OnGetUserReferralStatus {
    const queryClient = useQueryClient();

    return useCallback(
        async (_params, context) => {
            const { merchantId } = context;

            if (!merchantId) {
                throw new FrakRpcError(
                    RpcErrorCodes.configError,
                    "The current merchant doesn't exist within the Frak ecosystem"
                );
            }

            return queryClient.fetchQuery(
                userReferralStatusQueryOptions(merchantId)
            );
        },
        [queryClient]
    );
}
