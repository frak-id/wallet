import { authenticatedBackendApi } from "@frak-labs/wallet-shared";
import { useQuery } from "@tanstack/react-query";
import { installCodeKey } from "@/module/recovery-code/queryKeys/install-code";

/**
 * Hook to generate an install code for a merchant plus one credential.
 *
 * The backend takes either `anonymousId` or `checkoutToken`, never both, and
 * rejects a call carrying neither — so this never fires without one.
 *
 * `checkoutToken` wins: it is derived from the order server-side, while the
 * anonymous id reaching this page came from a buyer-writable cart attribute.
 */
export function useGenerateInstallCode({
    merchantId,
    anonymousId,
    checkoutToken,
    proof,
    retry = 3,
}: {
    merchantId?: string;
    anonymousId?: string;
    /** Shopify credential; preferred over `anonymousId` whenever present. */
    checkoutToken?: string;
    /** frak-install-v1 proof, read from the `#p=` fragment. */
    proof?: string;
    /** Attempts after the first, for 5xx/network only. Tests pass `false`. */
    retry?: number | false;
}) {
    const hasCredential = !!anonymousId || !!checkoutToken;

    return useQuery({
        queryKey: installCodeKey.generate(
            merchantId,
            anonymousId,
            checkoutToken
        ),
        queryFn: async () => {
            if (!merchantId || !hasCredential) return null;

            const { data, error } = await authenticatedBackendApi.user.identity[
                "install-code"
            ].generate.post(
                // The proof binds the anonymous id, so it is meaningless on the
                // token arm and the backend never reads it there.
                checkoutToken
                    ? { merchantId, checkoutToken }
                    : { merchantId, anonymousId, proof }
            );

            if (data) return data;

            // A refused credential is terminal — refreshing never helps, and the
            // view renders the download CTA instead of an error. Anything else
            // (5xx, network) still throws so the query retries.
            const status = error?.status;
            if (status && status >= 400 && status < 500) {
                return null;
            }
            // Status rides on the message: it is the only failure signal left
            // now the view renders no error, and `.name` is always "Error".
            throw new Error(
                `Failed to generate install code (${status ?? "network"})`
            );
        },
        enabled: !!merchantId && hasCredential,
        // A refetch burns rate-limit budget on refocus (5/min shared with the
        // sharing page), and when the backend cannot reuse the live row it
        // would show a code the pasteboard doesn't hold.
        staleTime: Number.POSITIVE_INFINITY,
        // Pinned here rather than left to the host client: the standalone
        // `/install` entrypoint defaults to `retry: 1` while the SPA takes
        // react-query's 3, and this mint runs in a mobile web view on cellular
        // mid-install. Only 5xx/network reach this; a 4xx returned null above.
        retry,
        // Capped at 2s: the default doubling spends 7s on a spinner before the
        // user sees the download CTA, which costs more than the code is worth.
        retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 2000),
        // `staleTime` alone does not hold an errored query: it has no data, so
        // it reports stale and a focus/reconnect would re-mint all four
        // attempts. Backgrounding a web view mid-install is the common case.
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
    });
}
