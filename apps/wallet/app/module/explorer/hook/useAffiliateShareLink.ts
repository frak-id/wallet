import { authenticatedBackendApi } from "@frak-labs/wallet-shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const affiliateShareKeys = {
    all: ["explorer", "affiliate-share"] as const,
    byMerchant: (merchantId: string) =>
        [...affiliateShareKeys.all, merchantId] as const,
};

/**
 * Drives the lazy two-step affiliate share flow for explorer merchants flagged
 * `integration: "affiliate"`:
 *  1. `GET  /user/affiliate/:merchantId/link` reads any link the user already
 *     minted (returns `null` when none exists yet) — no minting on load.
 *  2. `create()` (`POST`) mints the link on explicit user action, then primes
 *     the read cache so the UI flips straight to the copy/share step.
 *
 * The attribution token is bound server-side to the wallet identity, so the
 * frontend never picks its own token.
 */
export function useAffiliateShareLink({
    merchantId,
    enabled = true,
}: {
    merchantId: string;
    enabled?: boolean;
}) {
    const queryClient = useQueryClient();
    const queryKey = affiliateShareKeys.byMerchant(merchantId);

    const query = useQuery({
        queryKey,
        queryFn: async () => {
            const { data, error } = await authenticatedBackendApi.user
                .affiliate({ merchantId })
                .link.get();
            if (error) throw error;
            // Normalise the "no link yet" case to `null` for a stable cache value.
            return data ?? null;
        },
        enabled,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });

    const mutation = useMutation({
        mutationFn: async () => {
            const { data, error } = await authenticatedBackendApi.user
                .affiliate({ merchantId })
                .link.post();
            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            queryClient.setQueryData(queryKey, data);
        },
    });

    return {
        link: query.data ?? undefined,
        isLoading: query.isLoading,
        create: mutation.mutate,
        isCreating: mutation.isPending,
    };
}
