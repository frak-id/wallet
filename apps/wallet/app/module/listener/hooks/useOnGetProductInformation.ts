import { estimatedInteractionRewardQuery } from "@/module/listener/hooks/useEstimatedInteractionReward";
import { getProductMetadataQuery } from "@/module/listener/hooks/useGetProductMetadata";
import type { WalletRpcContext } from "@/module/listener/types/context";
import type { IFrameRpcSchema } from "@frak-labs/core-sdk";
import {
    FrakRpcError,
    RpcErrorCodes,
    type RpcPromiseHandler,
} from "@frak-labs/rpc";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

type OnGetProductInformation = RpcPromiseHandler<
    IFrameRpcSchema,
    "frak_getProductInformation",
    WalletRpcContext
>;

/**
 * Get the current product information
 *
 * Note: Context is augmented by middleware with productId, sourceUrl, etc.
 */
export function useOnGetProductInformation(): OnGetProductInformation {
    const queryClient = useQueryClient();

    return useCallback(
        async (_params, context) => {
            // ProductId is available directly from context (augmented by middleware)
            const { productId } = context;

            const [estimatedReward, productMetadata] = await Promise.all([
                queryClient.fetchQuery(
                    estimatedInteractionRewardQuery({ productId })
                ),
                queryClient.fetchQuery(getProductMetadataQuery({ productId })),
            ]);

            if (!(productId && productMetadata)) {
                throw new FrakRpcError(
                    RpcErrorCodes.configError,
                    "The current product doesn't exist within the Frak ecosystem"
                );
            }

            return {
                id: productId,
                maxReferrer: estimatedReward?.maxReferrer,
                maxReferee: estimatedReward?.maxReferee,
                rewards: estimatedReward?.rewards ?? [],
                onChainMetadata: productMetadata,
            };
        },
        [queryClient]
    );
}
