import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authenticatedBackendApi } from "@/context/api/backendClient";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";

export function useSyncMerchantBank({ merchantId }: { merchantId: string }) {
    const isDemoMode = useIsDemoMode();
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["merchant", merchantId, "bank", "sync"],
        mutationFn: async () => {
            if (isDemoMode) {
                await new Promise((resolve) => setTimeout(resolve, 500));
                return {
                    success: true,
                    rolesGranted: true,
                    rolesRevoked: false,
                };
            }

            const { data, error } = await authenticatedBackendApi
                .merchant({ merchantId })
                .bank.sync.post();

            if (!data || error) {
                throw new Error("Failed to sync merchant bank");
            }

            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["merchant", merchantId, "bank"],
            });
        },
    });
}
