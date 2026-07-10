import { useMutation, useQuery } from "@tanstack/react-query";
import { sleep } from "radash";
import { authenticatedBackendApi } from "@/api/backendClient";

/**
 * Hook to fetch the dns record to be set
 * @param domain
 * @param enabled
 */
export function useDnsTxtRecordToSet({
    domain,
    enabled,
}: {
    domain?: string;
    enabled: boolean;
}) {
    return useQuery({
        queryKey: ["merchant", "register", "dns-record", domain],
        queryFn: async ({ signal }) => {
            if (!domain) return "";

            // Manual sleep to do a debounce like effect
            await sleep(300);
            if (signal.aborted) return "";

            // Fetch the dns txt string
            const { data } = await authenticatedBackendApi.merchant.register[
                "dns-txt"
            ].get({
                query: { domain },
            });
            return data?.dnsTxt ?? "";
        },
        enabled: enabled && !!domain,
    });
}

/**
 * Function to check:
 *  - if the merchant isn't already registered
 *  - if the dns record is set
 */
export function useCheckDomainName() {
    return useMutation({
        mutationKey: ["merchant", "register", "check-domain-name"],
        mutationFn: async ({
            domain,
            setupCode,
        }: {
            domain: string;
            setupCode?: string;
        }) => {
            const { data, error } =
                await authenticatedBackendApi.merchant.register.verify.get({
                    query: { domain, setupCode },
                });
            if (error) throw error;

            return {
                isDomainValid: data?.isDomainValid ?? false,
                isAlreadyRegistered: data?.isAlreadyRegistered ?? false,
                // §4.10 third DNS bypass: the session's Shopify credential
                // already proved this domain via OAuth — skip the DNS TXT flow
                // and show the "verified thanks to Shopify" banner instead.
                verifiedViaShopify: data?.verifiedViaShopify ?? false,
            };
        },
    });
}
