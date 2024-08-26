import {
    getDnsTxtString,
    verifyDomainName,
} from "@/context/content/action/verifyDomain";
import { useMutation, useQuery } from "@tanstack/react-query";

/**
 * Hook to fetch the dns record to be set
 * @param name
 * @param domain
 * @param enabled
 */
export function useDnsTxtRecordSet({
    name,
    domain,
    enabled,
}: { name: string; domain?: string; enabled: boolean }) {
    return useQuery({
        queryKey: ["mint", "dns-record", name, domain],
        queryFn: async () => {
            if (!domain) return "";

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
 *  - if the content isn't already minted
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
