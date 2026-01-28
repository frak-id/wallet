import type { Stablecoin } from "@frak-labs/app-essentials";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Hex } from "viem";
import { authenticatedBackendApi } from "@/context/api/backendClient";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";

/**
 * Hook to fund a bank
 */
export function useFundTestBank() {
    const isDemoMode = useIsDemoMode();
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["merchant", "bank", "test-funding"],
        mutationFn: async ({
            bank,
            stablecoin,
        }: {
            bank: Hex;
            stablecoin?: Stablecoin;
        }) => {
            // In demo mode, simulate success
            if (isDemoMode) {
                await new Promise((resolve) => setTimeout(resolve, 300));
                await queryClient.invalidateQueries({
                    queryKey: ["merchant"],
                    exact: false,
                });
                return;
            }

            await authenticatedBackendApi.funding.getTestToken.post({
                bank,
                stablecoin,
            });
            await queryClient.invalidateQueries({
                queryKey: ["merchant"],
                exact: false,
            });
        },
    });
}
