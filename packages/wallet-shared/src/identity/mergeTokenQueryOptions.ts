import { queryOptions } from "@tanstack/react-query";
import { authenticatedBackendApi } from "../common/api/backendClient";

/**
 * Query keys for identity merge tokens.
 */
export const mergeTokenKeys = {
    all: ["identity", "merge-token"] as const,
    byParams: (args: {
        merchantId: string | undefined;
        sourceAnonymousId?: string | undefined;
    }) =>
        [
            ...mergeTokenKeys.all,
            args.merchantId ?? "no-merchant",
            args.sourceAnonymousId ?? "wallet-auth",
        ] as const,
};

/**
 * Shared `queryOptions` for fetching an identity merge token from
 * `POST /user/identity/merge/initiate`.
 *
 * Two sources are supported:
 *  - **Anonymous SDK session** (listener): pass `sourceAnonymousId` (clientId).
 *    The token ties the per-merchant anonymous fingerprint group.
 *  - **Authenticated wallet** (wallet app explorer): omit `sourceAnonymousId`.
 *    `authenticatedBackendApi` automatically attaches `x-wallet-auth`, and
 *    the backend resolves the wallet's identity group from the session.
 *
 * When both are available (e.g. listener with an authenticated SDK session),
 * the backend merges the wallet and anonymous groups before minting the
 * token — so the resulting token carries the combined identity.
 *
 * Consumers wrap this with `useQuery` and add their own `enabled` gate
 * (e.g. wallet-session presence) as needed.
 */
export function mergeTokenQueryOptions(args: {
    merchantId: string | undefined;
    sourceAnonymousId?: string | undefined;
}) {
    const { merchantId, sourceAnonymousId } = args;
    return queryOptions({
        queryKey: mergeTokenKeys.byParams(args),
        queryFn: async (): Promise<string | null> => {
            if (!merchantId) return null;
            const { data } =
                await authenticatedBackendApi.user.identity.merge.initiate.post(
                    {
                        ...(sourceAnonymousId ? { sourceAnonymousId } : {}),
                        merchantId,
                    }
                );
            return data?.mergeToken ?? null;
        },
        enabled: !!merchantId,
        // Backend tokens live for 60 min; these windows keep the cache warm
        // while the modal / page is open without hammering the endpoint.
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });
}
