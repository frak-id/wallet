import { authenticatedBackendApi } from "@/context/common/backendClient";
import { getIFrameResolvingContext } from "@/context/sdk/utils/iIframeContext";
import type { FullInteractionTypesKey } from "@frak-labs/core-sdk";
import { useQuery } from "@tanstack/react-query";
import type { Hex } from "viem";

/**
 * The query data to fetch the estimated interaction reward
 * @param productId
 * @param interaction
 */
export const estimatedInteractionRewardQuery = ({
    productId: initialProductId,
    interaction,
}: { productId?: Hex; interaction?: FullInteractionTypesKey }) => ({
    queryKey: [
        "interactions",
        "estimated-reward",
        initialProductId ?? "no-initial-product-id",
        interaction ?? "no-key-filter",
    ],
    async queryFn() {
        const productId =
            initialProductId ?? getIFrameResolvingContext()?.productId;
        if (!productId) {
            return null;
        }

        const { data, error } =
            await authenticatedBackendApi.interactions.reward.estimate.get({
                query: {
                    productId: productId,
                    ...(interaction ? { interactionKey: interaction } : {}),
                },
            });
        if (error) throw error;

        // Floor it so we don't have floating point issues
        return data?.totalReferrerEur?.toFixed(2) ?? null;
    },
});

/**
 * Fetch the estimated interaction reward for this interaction
 * @param interaction
 */
export function useEstimatedInteractionReward({
    interaction,
}: {
    interaction?: FullInteractionTypesKey;
} = {}) {
    const { data, ...query } = useQuery(
        estimatedInteractionRewardQuery({
            interaction,
        })
    );

    return {
        ...query,
        estimatedReward: data,
    };
}
