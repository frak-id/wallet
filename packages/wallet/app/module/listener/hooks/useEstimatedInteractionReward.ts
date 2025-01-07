import { authenticatedBackendApi } from "@/context/common/backendClient";
import { getIFrameResolvingContext } from "@/context/sdk/utils/iframeContext";
import type { FullInteractionTypesKey } from "@frak-labs/core-sdk";
import { useQuery } from "@tanstack/react-query";
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
        "estimated-interactions-reward",
        productId ?? "no-initial-product-id",
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
    const productId = useMemo(() => getIFrameResolvingContext()?.productId, []);
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
