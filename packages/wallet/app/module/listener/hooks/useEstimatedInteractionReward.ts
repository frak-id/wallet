import { authenticatedBackendApi } from "@/context/common/backendClient";
import { listenerContextAtom } from "@/module/listener/atoms/listenerContext";
import type { FullInteractionTypesKey } from "@frak-labs/nexus-sdk/core";
import { useQuery } from "@tanstack/react-query";
import { atom, useAtomValue } from "jotai";

/**
 * The current listener product id
 */
const listenerProductIdAtom = atom(
    (get) => get(listenerContextAtom)?.productId
);

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

    const { data, ...query } = useQuery({
        queryKey: [
            "interactions",
            "estimated-reward",
            listenerProductId ?? "no-product-id",
            interaction ?? "no-key-filter",
        ],
        async queryFn() {
            if (!listenerProductId) {
                return null;
            }

            const { data, error } =
                await authenticatedBackendApi.interactions.reward.estimate.get({
                    query: {
                        productId: listenerProductId,
                        ...(interaction ? { interactionKey: interaction } : {}),
                    },
                });
            console.log("Result", {
                data,
                error,
                listenerProductId: listenerProductId,
                interaction,
            });
            if (error) throw error;

            // Floor it so we don't have floating point issues
            return data?.totalEur?.toFixed(2) ?? null;
        },
    });

    return {
        ...query,
        estimatedReward: data,
    };
}
