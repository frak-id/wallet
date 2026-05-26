import type { MergePreviewResponse } from "@frak-labs/backend-elysia/api/schemas";
import { authenticatedWalletApi, authKey } from "@frak-labs/wallet-shared";
import { useQuery } from "@tanstack/react-query";

/**
 * Read-only recap of the same-device wallet merge that would happen if the
 * current credential merged with `targetAuthenticatorId`. The backend
 * recomputes the preview deterministically from the same inputs every call,
 * but the result depends on BOTH the target credential and the requester's
 * (the one carried in the JWT), so the cache key includes both — a
 * session switch between renders must not return a stale preview that
 * still resolves to the previous requester's winner.
 */
export function useMergePreview(
    targetAuthenticatorId?: string,
    requesterAuthenticatorId?: string
) {
    return useQuery<MergePreviewResponse, Error>({
        queryKey: targetAuthenticatorId
            ? authKey.merge.preview(
                  targetAuthenticatorId,
                  requesterAuthenticatorId ?? ""
              )
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
