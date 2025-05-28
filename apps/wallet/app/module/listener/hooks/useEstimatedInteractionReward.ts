import { authenticatedWalletApi } from "@/module/common/api/backendClient";
import { iframeResolvingContextAtom } from "@/module/listener/atoms/resolvingContext";
import { listenerInteractionsKey } from "@/module/listener/queryKeys/interactions";
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
    queryKey: listenerInteractionsKey.estimatedReward.byProduct(
        productId,
        interaction
    ),
    async queryFn() {
        if (!productId) {
            throw new Error("No product id provided");
        }

        const { data, error } =
            await authenticatedWalletApi.interactions.estimate.get({
                query: {
                    productId: productId,
                    ...(interaction ? { interactionKey: interaction } : {}),
                },
            });
        if (error) throw error;

        if (!data?.maxReferrer) {
            return null;
        }

        // Return formatted stuff
        return {
            maxReferrer: data.maxReferrer,
            maxReferee: data.maxReferee,
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
}: {
    interaction?: FullInteractionTypesKey;
} = {}) {
    const contextProductId = useAtomValue(
        iframeResolvingContextAtom
    )?.productId;
    const productId = useMemo(() => contextProductId, [contextProductId]);
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
