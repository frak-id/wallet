import { useSetupInteractionContract } from "@/module/product/hook/useSetupInteractionContract";
import type { ProductTypesKey } from "@frak-labs/nexus-sdk/core";
import { backendApi } from "@frak-labs/shared/context/server";
import { useMutation } from "@tanstack/react-query";

/**
 * Hook to mint the user product
 */
export function useMintMyProduct() {
    const { mutateAsync: deployInteractionContract } =
        useSetupInteractionContract();

    return useMutation({
        mutationKey: ["product", "launch-mint"],
        mutationFn: async ({
            name,
            domain,
            productTypes,
        }: {
            name: string;
            domain: string;
            productTypes: ProductTypesKey[];
        }) => {
            const { data, error } = await backendApi.business.mint.put({
                name,
                domain,
                productTypes,
            });
            if (error) throw error;

            // Setup the interaction contract if needed
            await deployInteractionContract({
                productId: data.productId,
                directAllowValidator: true,
            });

            return {
                mintTxHash: data.txHash,
            };
        },
    });
}
