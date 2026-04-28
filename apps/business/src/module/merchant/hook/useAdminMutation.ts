import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Address } from "viem";
import { authenticatedBackendApi } from "@/api/backendClient";

type AdminMutationArg = {
    merchantId: string;
    wallet: Address;
};

type AdminMutationOptions = {
    action: "add" | "remove";
};

export function useAdminMutation({ action }: AdminMutationOptions) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: [
            "merchant",
            action === "add" ? "add-member" : "remove-member",
        ],
        mutationFn: async (args: AdminMutationArg) => {
            if (action === "add") {
                const { data, error } = await authenticatedBackendApi
                    .merchant({ merchantId: args.merchantId })
                    .admins.post({ wallet: args.wallet });

                if (!data || error) {
                    throw new Error("Failed to add admin");
                }

                return data;
            } else {
                const { error } = await authenticatedBackendApi
                    .merchant({ merchantId: args.merchantId })
                    .admins({ wallet: args.wallet })
                    .delete();

                if (error) {
                    throw new Error("Failed to remove admin");
                }
            }
        },
        onSuccess: (_data, args) => {
            queryClient.invalidateQueries({
                queryKey: ["merchant", "team", args.merchantId],
            });
        },
    });
}
