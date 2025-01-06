import type { IFrameRequestResolver } from "@/context/sdk/utils/iFrameRequestResolver";
import { estimatedInteractionRewardQuery } from "@/module/listener/hooks/useEstimatedInteractionReward";
import { getProductMetadataQuery } from "@/module/listener/hooks/useGetProductMetadata";
import {
    type ExtractedParametersFromRpc,
    type IFrameRpcSchema,
    RpcErrorCodes,
} from "@frak-labs/core-sdk";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

type OnGetProductInformation = IFrameRequestResolver<
    Extract<
        ExtractedParametersFromRpc<IFrameRpcSchema>,
        { method: "frak_getProductInformation" }
    >
>;

/**
 * Get the current product information
 */
export function useOnGetProductInformation(): OnGetProductInformation {
    const queryClient = useQueryClient();

    return useCallback(
        async (_request, { productId }, emitter) => {
            const [estimatedReward, productMetadata] = await Promise.all([
                queryClient.fetchQuery(
                    estimatedInteractionRewardQuery({ productId })
                ),
                queryClient.fetchQuery(getProductMetadataQuery({ productId })),
            ]);

            if (!(productId && productMetadata)) {
                await emitter({
                    error: {
                        code: RpcErrorCodes.configError,
                        message:
                            "The current product doesn't exist within the Frak ecosystem",
                    },
                });
                return;
            }

            await emitter({
                result: {
                    id: productId,
                    estimatedEurReward: estimatedReward ?? undefined,
                    onChainMetadata: productMetadata,
                },
            });
        },
        [queryClient]
    );
}
