import { backendApi } from "@frak-labs/shared/context/server";
import { useMutation, useQuery } from "@tanstack/react-query";
import { sleep } from "radash";

/**
 * Hook to fetch the dns record to be set
 * @param name
 * @param domain
 * @param enabled
 */
export function useDnsTxtRecordToSet({
    domain,
    enabled,
}: { domain?: string; enabled: boolean }) {
    return useQuery({
        queryKey: ["mint", "dns-record", domain],
        queryFn: async ({ signal }) => {
            if (!domain) return "";

            // Manual sleep to do a debounce like effect
            await sleep(300);
            if (signal.aborted) return "";

            // Fetch the dns txt string
            const { data } = await backendApi.business.mint.dnsTxt.get({
                query: { domain },
            });
            return data ?? "";
        },
        enabled: enabled && !!domain,
    });
}

/**
 * Function ot check:
 *  - if the product isn't already minted
 *  - if the dns record is set
 */
export function useCheckDomainName() {
    return useMutation({
        mutationKey: ["mint", "check-domain-name"],
        mutationFn: async ({ domain }: { domain: string }) => {
            const { data, error } = await backendApi.business.mint.verify.get({
                query: { domain },
            });
            if (error) throw error;

            return data;
        },
    });
}
