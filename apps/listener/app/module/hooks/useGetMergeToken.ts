import { authenticatedBackendApi } from "@frak-labs/wallet-shared";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { listenerIdentityKey } from "@/module/queryKeys/identity";
import { resolvingContextStore } from "@/module/stores/resolvingContextStore";

export function useGetMergeToken() {
    const context = resolvingContextStore((state) => state.context);
    const clientId = context?.clientId;
    const merchantId = context?.merchantId;

    const { data, refetch } = useQuery({
        queryKey: listenerIdentityKey.merge.token(clientId, merchantId),
        queryFn: async () => {
            if (!clientId || !merchantId) return null;

            const { data } =
                await authenticatedBackendApi.user.identity.merge.initiate.post(
                    {
                        sourceAnonymousId: clientId,
                        merchantId,
                    }
                );
            return data?.mergeToken ?? null;
        },
        enabled: !!clientId && !!merchantId,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });

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
