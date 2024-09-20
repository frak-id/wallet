import { mintProduct } from "@/context/product/action/mint";
import { useSetupInteractionContract } from "@/module/product/hook/useSetupInteractionContract";
import type { ProductTypesKey } from "@frak-labs/nexus-sdk/core";
import { useMutation } from "@tanstack/react-query";

/**
 * Hook to mint the user product
 */
export function useMintMyProduct() {
    const { mutateAsync: deployInteractionContract } =
        useSetupInteractionContract();

    return useMutation({
        mutationKey: ["product", "launch-mint"],
        mutationFn: async (args: {
            name: string;
            domain: string;
            productTypes: ProductTypesKey[];
            setupInteractions?: boolean;
        }) => {
            // Perform the backend side of the mint
            const { mintTxHash, productId } = await mintProduct(args);

            // Setup the interaction contract
            await deployInteractionContract({
                productId,
                directAllowValidator: true,
            });

            return {
                mintTxHash,
            };
        },
    });
}
