import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Address } from "viem";
import { authenticatedBackendApi } from "@/context/api/backendClient";

type AddAdminArg = {
    merchantId: string;
    wallet: Address;
};

export function useAddAdmin() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["merchant", "add-member"],
        mutationFn: async (args: AddAdminArg) => {
            const { data, error } = await authenticatedBackendApi
                .merchant({ merchantId: args.merchantId })
                .admins.post({ wallet: args.wallet });

            if (!data || error) {
                throw new Error("Failed to add admin");
            }

            return data;
        },
        onSuccess: (_data, args) => {
            queryClient.invalidateQueries({
                queryKey: ["merchant", "team", args.merchantId],
            });
        },
    });
}
