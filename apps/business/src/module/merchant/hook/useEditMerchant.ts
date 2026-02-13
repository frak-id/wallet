import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Address } from "viem";
import { authenticatedBackendApi } from "@/api/backendClient";

type EditMerchantInput = {
    name?: string;
    defaultRewardToken?: Address;
};

export function useEditMerchant({ merchantId }: { merchantId: string }) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["merchant", "edit", merchantId],
        mutationFn: async (input: EditMerchantInput) => {
            const { error } = await authenticatedBackendApi
                .merchant({ merchantId })
                .put(input);

            if (error) {
                throw new Error("Failed to update merchant");
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
