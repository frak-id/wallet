import { mergeTokenQueryOptions } from "@frak-labs/wallet-shared";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { resolvingContextStore } from "@/module/stores/resolvingContextStore";

export function useGetMergeToken() {
    const context = resolvingContextStore((state) => state.context);
    const clientId = context?.clientId;
    const merchantId = context?.merchantId;

    const { data, refetch } = useQuery(
        mergeTokenQueryOptions({
            merchantId,
            sourceAnonymousId: clientId,
        })
    );

    return useCallback(async (): Promise<string | undefined> => {
        if (data) return data;

        if (!clientId || !merchantId) return undefined;

        try {
            const { data: refetchedData } = await refetch();
            return refetchedData ?? undefined;
        } catch {
            return undefined;
        }
    }, [data, clientId, merchantId, refetch]);
}
