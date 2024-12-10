import type { IFrameRequestResolver } from "@/context/sdk/utils/iFrameRequestResolver";
import { listenerProductIdAtom } from "@/module/listener/atoms/listenerContext";
import { useEstimatedInteractionReward } from "@/module/listener/hooks/useEstimatedInteractionReward";
import { useGetProductMetadata } from "@/module/listener/hooks/useGetProductMetadata";
import {
    type ExtractedParametersFromRpc,
    type IFrameRpcSchema,
    RpcErrorCodes,
} from "@frak-labs/nexus-sdk/core";
import { useAtomValue } from "jotai/index";
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
    const productId = useAtomValue(listenerProductIdAtom);
    const { promise: estimatedRewardAsync } = useEstimatedInteractionReward();
    const { promise: productMetadataAsync } = useGetProductMetadata();

    return useCallback(
        async (_request, _context, emitter) => {
            const [estimatedReward, productMetadata] = await Promise.all([
                estimatedRewardAsync,
                productMetadataAsync,
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
        [productId, estimatedRewardAsync, productMetadataAsync]
    );
}
