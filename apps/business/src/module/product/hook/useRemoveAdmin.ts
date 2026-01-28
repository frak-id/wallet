import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Address } from "viem";
import { authenticatedBackendApi } from "@/context/api/backendClient";

type RemoveAdminArg = {
    merchantId: string;
    wallet: Address;
};

export function useRemoveAdmin() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["product", "remove-member"],
        mutationFn: async (args: RemoveAdminArg) => {
            const { data, error } = await authenticatedBackendApi
                .merchant({ merchantId: args.merchantId })
                .admins({ wallet: args.wallet })
                .delete();

            if (!data || error) {
                throw new Error("Failed to remove admin");
            }

            return data;
        },
        onSuccess: (_data, args) => {
            queryClient.invalidateQueries({
                queryKey: ["product", "team", args.merchantId],
            });
        },
    });
}
