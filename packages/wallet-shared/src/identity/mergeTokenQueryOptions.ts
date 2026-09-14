import { trackEvent } from "../common/analytics";
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
        proof?: string | undefined;
    }) =>
        [
            ...mergeTokenKeys.all,
            args.merchantId ?? "no-merchant",
            args.sourceAnonymousId ?? "wallet-auth",
            // Presence only: a query key is serialised into devtools and any
            // persisted cache, and a proof is bearer material.
            args.proof ? "proven" : "proofless",
        ] as const,
};

/**
 * `queryOptions` for `POST /user/identity/merge/initiate`. Pass
 * `sourceAnonymousId` (clientId) for an anonymous SDK session, omit it for an
 * authenticated wallet (`x-wallet-auth` resolves the group server-side).
 *
 * The `proof` accompanying `sourceAnonymousId` is `frak-merge-v1` with an
 * EMPTY binding — the execute-side proof binds `SHA-256(mergeToken)` and 403s
 * here. A `sourceAnonymousId` without a proof is refused outright.
 */
export function mergeTokenQueryOptions(args: {
    merchantId: string | undefined;
    sourceAnonymousId?: string | undefined;
    proof?: string | undefined;
}) {
    const { merchantId, sourceAnonymousId, proof } = args;
    return queryOptions({
        queryKey: mergeTokenKeys.byParams(args),
        queryFn: async (): Promise<string | null> => {
            if (!merchantId) return null;
            // Field-based like the backend's, which enforces on
            // `sourceAnonymousId` alone — the only thing it can trust. The
            // wallet-auth arm names none, so its session is its attestation.
            if (sourceAnonymousId && !proof) {
                // Counted before the return: no request reaches the backend, so
                // this event is the only way to see the refused population.
                trackEvent("merge_initiate_proofless");
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
