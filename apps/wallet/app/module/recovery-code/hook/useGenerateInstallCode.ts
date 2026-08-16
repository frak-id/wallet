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
}: {
    merchantId?: string;
    anonymousId?: string;
    /** Shopify credential; preferred over `anonymousId` whenever present. */
    checkoutToken?: string;
    /** frak-install-v1 proof, read from the `#p=` fragment. */
    proof?: string;
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
            throw new Error("Failed to generate install code");
        },
        enabled: !!merchantId && hasCredential,
        // Each generate mints a new row (no upsert on merchantId+anonymousId): a refetch would show a code the pasteboard doesn't hold, and burns rate-limit budget on refocus.
        staleTime: Number.POSITIVE_INFINITY,
    });
}
