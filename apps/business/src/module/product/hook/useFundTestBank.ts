import type { Stablecoin } from "@frak-labs/app-essentials";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Hex } from "viem";
import { authenticatedBackendApi } from "@/context/api/backendClient";

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
        }: {
            bank: Hex;
            stablecoin?: Stablecoin;
        }) => {
            await authenticatedBackendApi.funding.getTestToken.post({
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
