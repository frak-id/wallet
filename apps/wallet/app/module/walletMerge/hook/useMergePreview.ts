import type { MergePreviewResponse } from "@frak-labs/backend-elysia/api/schemas";
import { authenticatedWalletApi, authKey } from "@frak-labs/wallet-shared";
import { useQuery } from "@tanstack/react-query";

/**
 * Read-only recap of the same-device wallet merge that would happen if the
 * current credential merged with `targetAuthenticatorId`. The backend
 * recomputes the preview deterministically from the same inputs every call,
 * so the cache key only needs the target credential id.
 *
 * The hook is intentionally a `useQuery` rather than a mutation: the recap
 * must render before the user clicks "Continue", and the data also feeds the
 * downstream steps (consent challenge, on-chain calldata). Re-fetching is
 * cheap and idempotent.
 */
export function useMergePreview(targetAuthenticatorId?: string) {
    return useQuery<MergePreviewResponse, Error>({
        queryKey: targetAuthenticatorId
            ? authKey.merge.preview(targetAuthenticatorId)
            : authKey.merge.preview("none"),
        enabled: Boolean(targetAuthenticatorId),
        queryFn: async () => {
            if (!targetAuthenticatorId) {
                throw new Error("No targetAuthenticatorId provided");
            }
            const { data, error } =
                await authenticatedWalletApi.merge.preview.get({
                    query: { targetAuthenticatorId },
                });
            if (error) throw error;
            return data;
        },
        // Preview is stable for ~minutes; weights have a 30s server TTL.
        staleTime: 30_000,
    });
}
