import { authenticatedBackendApi } from "../common/api/backendClient";
import { queryOptions } from "../common/utils/queryOptions";

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
 *
 * TODO(merge-initiate-proof): the `sourceAnonymousId` arm sends NO proof, so
 * it can never latch and stays on the backend's fail-open path
 * (`AnonymousMergeOrchestrator.enforceProof`). It must carry one before that
 * arm is made unconditionally mandatory (ROLLOUT-STEP-3), or the listener's
 * in-app-browser escape 403s outright.
 *
 * Deferred deliberately, not overlooked: the only consumers (listener modal,
 * embedded wallet) have no production merchant today, and the wallet-app
 * explorer arm is unaffected since it's authenticated by session instead.
 *
 * Two real constraints when this is picked up:
 *  1. The proof must be `frak-merge-v1` with an EMPTY binding, as
 *     `sdk/core/src/actions/getMergeToken.ts` produces. Reusing
 *     `sdkIdentity.proofs.merge` from `resolved-config` would 403 — that one
 *     binds `SHA-256(mergeToken)`, for the `execute` side.
 *  2. `frak-merge-v1`'s window is 10 min, which a modal left open for longer
 *     than that still outlives: a proof signed at open time expires while the
 *     user reads. Signing lazily isn't possible, so the empty-binding initiate
 *     case may still need its own window.
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
