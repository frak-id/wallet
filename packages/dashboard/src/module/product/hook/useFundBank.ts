import { backendApi } from "@frak-labs/shared/context/server";
import { useMutation } from "@tanstack/react-query";
import type { Hex } from "viem";

/**
 * Hook to fund a bank
 */
export function useFundBank() {
    return useMutation({
        mutationKey: ["product", "bank"],
        mutationFn: async ({ bank }: { bank: Hex }) => {
            await backendApi.business.funding.getTestToken.post({
                bank,
            });
        },
    });
}
