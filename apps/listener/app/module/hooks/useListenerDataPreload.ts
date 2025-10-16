import { useQueries } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { useAccount } from "wagmi";
import { useGetSafeSdkSession } from "@frak-labs/wallet-shared/common/hook/useGetSafeSdkSession";
import { iframeResolvingContextAtom } from "@/module/atoms/resolvingContext";
import { estimatedInteractionRewardQuery } from "@/module/hooks/useEstimatedInteractionReward";
import { getProductMetadataQuery } from "@/module/hooks/useGetProductMetadata";
import { interactionSessionStatusQuery } from "@frak-labs/wallet-shared/wallet/hook/useInteractionSessionStatus";

/**
 * Small hook to preload some listener queries
 *  - SDK Session status, if some interaction are being pushed, and a sdk session is available, it will limit the overhead of SDK session renew
 *  - Interaction session status, since some modal step could be skipped based on that, we want to load it as soon as possible
 *  - Estimated reward, since it will be displayed inside some modal, we want it
 *
 *  Since some queries are context dependant (for instance, estimated reward depend on the listener context, that is only available when context is rdy),we are using a `useQueries` instead of the `queryClient.prefetchQuery()`
 *
 *  In a perfect world, we would have a `prefetchQuery`, that would allow use to load the query before the component is mounted.
 */
export function useListenerDataPreload() {
    const address = useAccount().address;
    const productId = useAtomValue(iframeResolvingContextAtom)?.productId;

    const queries = useMemo(
        () => [
            estimatedInteractionRewardQuery({ productId }),
            getProductMetadataQuery({ productId }),
            interactionSessionStatusQuery(address),
        ],
        [address, productId]
    );

    /**
     * Preload estimated interaction reward + session status
     */
    useQueries({ queries });

    /**
     * Preload the current SDK session
     */
    useGetSafeSdkSession();
}
