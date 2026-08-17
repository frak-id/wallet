import type { MergeInitiateProoflessSource } from "../common/analytics";
import { trackEvent } from "../common/analytics";
import { authenticatedBackendApi } from "../common/api/backendClient";
import { queryOptions } from "../common/utils/queryOptions";

/**
 * Which caller is asking for a merge token. `wallet_explorer` is the
 * authenticated arm and is never counted as proofless.
 */
export type MergeTokenSource = MergeInitiateProoflessSource | "wallet_explorer";

/**
 * Query keys for identity merge tokens.
 */
export const mergeTokenKeys = {
    all: ["identity", "merge-token"] as const,
    byParams: (args: {
        merchantId: string | undefined;
        sourceAnonymousId?: string | undefined;
        source: MergeTokenSource;
        proof?: string | undefined;
    }) =>
        [
            ...mergeTokenKeys.all,
            args.merchantId ?? "no-merchant",
            args.sourceAnonymousId ?? "wallet-auth",
            args.source,
            // Presence only: a query key is serialised into devtools and any
            // persisted cache, and a proof is bearer material.
            args.proof ? "proven" : "proofless",
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
 * The `sourceAnonymousId` arm carries `proof` when the SDK pushed one on
 * `resolved-config` (`sdkIdentity.proofs.mergeSource`). It is `frak-merge-v1`
 * with an EMPTY binding — `mergeExecute` binds `SHA-256(mergeToken)` and would
 * 403 here. Naming a `sourceAnonymousId` without one is refused outright.
 */
export function mergeTokenQueryOptions(args: {
    merchantId: string | undefined;
    sourceAnonymousId?: string | undefined;
    source: MergeTokenSource;
    proof?: string | undefined;
}) {
    const { merchantId, sourceAnonymousId, source, proof } = args;
    return queryOptions({
        queryKey: mergeTokenKeys.byParams(args),
        queryFn: async (): Promise<string | null> => {
            if (!merchantId) return null;
            // The refusal is field-based like the backend's, which enforces on
            // `sourceAnonymousId` alone — the only thing it can trust. The
            // counter stays source-based: its type excludes `wallet_explorer`,
            // whose session is its attestation.
            if (sourceAnonymousId && !proof) {
                // Counted before the return: no request reaches the backend, so
                // this event is the only way to see the refused population.
                if (source !== "wallet_explorer") {
                    trackEvent("merge_initiate_proofless", { source });
                }
                // The listener holds no key, so a refusal here costs one hop of
                // attribution and surfaces no error: the caller reads `null`.
                return null;
            }
            const { data } =
                await authenticatedBackendApi.user.identity.merge.initiate.post(
                    {
                        ...(sourceAnonymousId ? { sourceAnonymousId } : {}),
                        ...(proof ? { proof } : {}),
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
        // A merge token is a 60-minute bearer; persisting it would leave it
        // rehydratable from storage long after it expired.
        meta: { storable: false },
    });
}
