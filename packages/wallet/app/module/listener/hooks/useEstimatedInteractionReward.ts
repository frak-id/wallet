import { authenticatedBackendApi } from "@/context/common/backendClient";
import { listenerProductIdAtom } from "@/module/listener/atoms/listenerContext";
import type { FullInteractionTypesKey } from "@frak-labs/nexus-sdk/core";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import type { Hex } from "viem";

/**
 * The query data to fetch the estimated interaction reward
 * @param productId
 * @param interaction
 */
export const estimatedInteractionRewardQuery = ({
    productId,
    interaction,
}: { productId?: Hex; interaction?: FullInteractionTypesKey }) => {
    return {
        enabled: !!productId,
        queryKey: [
            "interactions",
            "estimated-reward",
            productId ?? "no-product-id",
            interaction ?? "no-key-filter",
        ],
        async queryFn() {
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
            return data?.totalEur?.toFixed(2) ?? null;
        },
    };
};

/**
 * Fetch the estimated interaction reward for this interaction
 * @param interaction
 */
export function useEstimatedInteractionReward({
    interaction,
}: {
    interaction?: FullInteractionTypesKey;
} = {}) {
    const listenerProductId = useAtomValue(listenerProductIdAtom);

    const { data, ...query } = useQuery(
        estimatedInteractionRewardQuery({
            productId: listenerProductId,
            interaction,
        })
    );

    return {
        ...query,
        estimatedReward: data,
    };
}
