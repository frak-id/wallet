import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authenticatedBackendApi } from "@/api/backendClient";

export function useAddAllowedDomain({ merchantId }: { merchantId: string }) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["merchant", "allowed-domains", "add", merchantId],
        mutationFn: async (domain: string) => {
            const { error } = await authenticatedBackendApi
                .merchant({ merchantId })
                ["allowed-domains"].post({ domain });

            if (error) {
                throw new Error("Failed to add allowed domain");
            }

            return { success: true };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["merchant", merchantId],
            });
        },
    });
}

export function useRemoveAllowedDomain({ merchantId }: { merchantId: string }) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["merchant", "allowed-domains", "remove", merchantId],
        mutationFn: async (domain: string) => {
            const { error } = await authenticatedBackendApi
                .merchant({ merchantId })
                ["allowed-domains"].delete({ domain });

            if (error) {
                throw new Error("Failed to remove allowed domain");
            }

            return { success: true };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["merchant", merchantId],
            });
        },
    });
}
