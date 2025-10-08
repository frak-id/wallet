import type { Stablecoin } from "@frak-labs/app-essentials";
import { businessApi } from "@frak-labs/client/server";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Hex } from "viem";

/**
 * Hook to fund a bank
 */
export function useFundTestBank() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["product", "bank"],
        mutationFn: async ({
            bank,
            stablecoin,
        }: { bank: Hex; stablecoin?: Stablecoin }) => {
            await businessApi.funding.getTestToken.post({
                bank,
                stablecoin,
            });
            await queryClient.invalidateQueries({
                queryKey: ["product"],
                exact: false,
            });
        },
    });
}
