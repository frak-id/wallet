import type { MergeTokenSource } from "@frak-labs/wallet-shared/identity";
import { mergeTokenQueryOptions } from "@frak-labs/wallet-shared/identity";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { useStore } from "zustand";
import { resolvingContextStore } from "@/module/stores/resolvingContextStore";

export function useGetMergeToken(source: MergeTokenSource) {
    const context = useStore(resolvingContextStore, (state) => state.context);
    const clientId = context?.clientId;
    const merchantId = context?.merchantId;

    const { data, refetch } = useQuery(
        mergeTokenQueryOptions({
            merchantId,
            sourceAnonymousId: clientId,
            source,
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
