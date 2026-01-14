import { useGetSafeSdkSession } from "@frak-labs/wallet-shared";
import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { estimatedInteractionRewardQuery } from "@/module/hooks/useEstimatedInteractionReward";
import { getProductMetadataQuery } from "@/module/hooks/useGetProductMetadata";
import { resolvingContextStore } from "@/module/stores/resolvingContextStore";

/**
 * Small hook to preload some listener queries
 *  - SDK Session status, if some interaction are being pushed, and a sdk session is available, it will limit the overhead of SDK session renew
 *  - Estimated reward, since it will be displayed inside some modal, we want it
 *
 *  Since some queries are context dependant (for instance, estimated reward depend on the listener context, that is only available when context is rdy),we are using a `useQueries` instead of the `queryClient.prefetchQuery()`
 *
 *  In a perfect world, we would have a `prefetchQuery`, that would allow use to load the query before the component is mounted.
 */
export function useListenerDataPreload() {
    const productId = resolvingContextStore(
        (state) => state.context?.productId
    );

    const queries = useMemo(
        () => [
            estimatedInteractionRewardQuery({ productId }),
            getProductMetadataQuery({ productId }),
        ],
        [productId]
    );

    /**
     * Preload estimated interaction reward + product metadata
     */
    useQueries({ queries });

    /**
     * Preload the current SDK session
     */
    useGetSafeSdkSession();
}
