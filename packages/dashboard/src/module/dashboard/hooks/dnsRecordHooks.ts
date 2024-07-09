import {
    getDnsTxtString,
    isDnsTxtRecordSet,
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
 * Function ot check if the dns record is set
 */
export function useCheckDnsTxtRecordSet() {
    return useMutation({
        mutationKey: ["mint", "check-dns-record"],
        mutationFn: async ({
            name,
            domain,
        }: { name: string; domain: string }) =>
            await isDnsTxtRecordSet({
                name,
                domain,
            }),
    });
}
