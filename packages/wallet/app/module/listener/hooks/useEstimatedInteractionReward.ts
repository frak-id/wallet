import { authenticatedBackendApi } from "@/context/common/backendClient";
import type { IFrameResolvingContext } from "@/context/sdk/utils/iFrameRequestResolver";
import { iframeResolvingContextAtom } from "@/module/atoms/resolvingContext";
import type {
    FullInteractionTypesKey,
    GetProductInformationReturnType,
} from "@frak-labs/core-sdk";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { useMemo } from "react";
import type { Hex } from "viem";

/**
 * The query data to fetch the estimated interaction reward
 * @param productId
 * @param interaction
 */
export const estimatedInteractionRewardQuery = ({
    productId,
    interaction,
}: { productId?: Hex; interaction?: FullInteractionTypesKey }) => ({
    enabled: !!productId,
    queryKey: [
        "interactions",
        "estimated-reward",
        productId ?? "no-product-id",
        interaction ?? "no-key-filter",
    ],
    async queryFn() {
        if (!productId) {
            throw new Error("No product id provided");
        }

        const { data, error } =
            await authenticatedBackendApi.interactions.reward.estimate.get({
                query: {
                    productId: productId,
                    ...(interaction ? { interactionKey: interaction } : {}),
                },
            });
        if (error) throw error;

        if (!data?.totalReferrerEur) {
            return null;
        }

        // Return formatted stuff
        return {
            estimatedEurReward: Math.ceil(data.totalReferrerEur).toString(),
            rewards:
                data.activeRewards as GetProductInformationReturnType["rewards"],
        };
    },
});

/**
 * Fetch the estimated interaction reward for this interaction
 * @param interaction
 */
export function useEstimatedInteractionReward({
    interaction,
    resolvingContext,
}: {
    interaction?: FullInteractionTypesKey;
    resolvingContext?: IFrameResolvingContext;
} = {}) {
    const contextProductId = useAtomValue(
        iframeResolvingContextAtom
    )?.productId;
    const productId = useMemo(
        () => resolvingContext?.productId ?? contextProductId,
        [resolvingContext, contextProductId]
    );
    const { data, ...query } = useQuery(
        estimatedInteractionRewardQuery({
            productId,
            interaction,
        })
    );

    return {
        ...query,
        estimatedReward: data,
    };
}
