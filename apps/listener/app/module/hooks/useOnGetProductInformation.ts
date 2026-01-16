import type { IFrameRpcSchema } from "@frak-labs/core-sdk";
import {
    FrakRpcError,
    RpcErrorCodes,
    type RpcPromiseHandler,
} from "@frak-labs/frame-connector";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { getProductMetadataQuery } from "@/module/hooks/useGetProductMetadata";
import type { WalletRpcContext } from "@/module/types/context";

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
            const { merchantId, productId } = context;

            const productMetadata = await queryClient.fetchQuery(
                getProductMetadataQuery({ merchantId, productId })
            );

            if (!(productId && productMetadata)) {
                throw new FrakRpcError(
                    RpcErrorCodes.configError,
                    "The current product doesn't exist within the Frak ecosystem"
                );
            }

            return {
                id: productId,
                maxReferrer: undefined,
                maxReferee: undefined,
                rewards: [],
                onChainMetadata: productMetadata,
            };
        },
        [queryClient]
    );
}
