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
        mutationFn: async ({
            domain,
            setupCode,
        }: { domain: string; setupCode?: string }) => {
            const { data, error } = await backendApi.business.mint.verify.get({
                query: { domain, setupCode },
            });
            if (error) throw error;

            return data;
        },
    });
}

/**
 * Hook to listen to the domain name setup
 * @param domain
 * @param enabled
 */
export function useListenToDomainNameSetup({
    domain,
    setupCode,
}: { domain: string; setupCode: string }) {
    return useQuery({
        queryKey: ["mint", "listen-to-domain-name-setup", domain, setupCode],
        queryFn: async () => {
            const { data, error } = await backendApi.business.mint.verify.get({
                query: { domain, setupCode },
            });
            if (error) {
                console.warn(
                    "Error while listening to domain name setup",
                    error
                );
                return false;
            }

            if (data?.isAlreadyMinted) {
                return false;
            }

            return data?.isDomainValid ?? false;
        },
        enabled: !!domain,
    });
}
