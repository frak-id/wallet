import { backendApi } from "@frak-labs/shared/context/server";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Hex } from "viem";

/**
 * Hook to fund a bank
 */
export function useFundBank() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["product", "bank"],
        mutationFn: async ({ bank }: { bank: Hex }) => {
            await backendApi.business.funding.getTestToken.post({
                bank,
            });
            await queryClient.invalidateQueries({
                queryKey: ["product"],
                exact: false,
            });
        },
    });
}
