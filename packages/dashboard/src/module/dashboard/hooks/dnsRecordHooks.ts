import {
    getDnsTxtString,
    verifyDomainName,
} from "@/context/product/action/verifyDomain";
import { useMutation, useQuery } from "@tanstack/react-query";
import { sleep } from "radash";

/**
 * Hook to fetch the dns record to be set
 * @param name
 * @param domain
 * @param enabled
 */
export function useDnsTxtRecordToSet({
    name,
    domain,
    enabled,
}: { name: string; domain?: string; enabled: boolean }) {
    return useQuery({
        queryKey: ["mint", "dns-record", name, domain],
        queryFn: async ({ signal }) => {
            if (!domain) return "";

            // Manual sleep to do a debounce like effect
            await sleep(300);
            if (signal.aborted) return "";

            // Fetch the dns txt string
            return await getDnsTxtString({
                name,
                domain,
            });
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
        mutationFn: async ({
            name,
            domain,
        }: { name: string; domain: string }) =>
            await verifyDomainName({
                name,
                domain,
            }),
    });
}
