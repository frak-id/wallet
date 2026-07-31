import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authenticatedBackendApi } from "@/api/backendClient";
import { extractAuthErrorCode } from "@/module/auth/utils/authError";
import { merchantByIdQueryKey } from "@/module/merchant/queries/queryKeys";
import { AllowedListError } from "./allowedListError";

export function useAddAllowedDomain({ merchantId }: { merchantId: string }) {
    const queryClient = useQueryClient();

    return useMutation<void, AllowedListError, string>({
        mutationKey: ["merchant", "allowed-domains", "add", merchantId],
        mutationFn: async (domain: string) => {
            const { error } = await authenticatedBackendApi
                .merchant({ merchantId })
                ["allowed-domains"].post({ domain });

            if (error) {
                // Rethrow the backend's typed `code` so the sheet can map the
                // one outcome a user can act on (the domain is already
                // claimed) to a translated message.
                throw new AllowedListError(extractAuthErrorCode(error));
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: merchantByIdQueryKey(merchantId),
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
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: merchantByIdQueryKey(merchantId),
            });
        },
    });
}
