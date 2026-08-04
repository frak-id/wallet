import { authenticatedBackendApi } from "@frak-labs/wallet-shared";
import { useQuery } from "@tanstack/react-query";
import { installCodeKey } from "@/module/recovery-code/queryKeys/install-code";

/**
 * Hook to generate an install code for a given merchant + anonymous user pair.
 *
 * The code is displayed on the `/install` page for the user to enter
 * in the mobile app after downloading it.
 */
export function useGenerateInstallCode({
    merchantId,
    anonymousId,
    proof,
}: {
    merchantId?: string;
    anonymousId?: string;
    /** frak-install-v1 proof, read from the `#p=` fragment. */
    proof?: string;
}) {
    return useQuery({
        queryKey: installCodeKey.generate(merchantId, anonymousId),
        queryFn: async () => {
            if (!merchantId || !anonymousId) return null;

            const { data, error } = await authenticatedBackendApi.user.identity[
                "install-code"
            ].generate.post({ merchantId, anonymousId, proof });

            if (error || !data) {
                throw new Error("Failed to generate install code");
            }

            return data;
        },
        enabled: !!merchantId && !!anonymousId,
    });
}
