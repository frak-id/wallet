import { mintProduct } from "@/context/product/action/mint";
import { useSendTransactionAction } from "@frak-labs/nexus-sdk/react";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
import { useMutation } from "@tanstack/react-query";

/**
 * Hook to mint the user product
 */
export function useMintMyProduct() {
    const { mutateAsync: sendTx } = useSendTransactionAction();

    return useMutation({
        mutationKey: ["product", "launch-mint"],
        mutationFn: async (args: {
            name: string;
            domain: string;
            productTypes: bigint;
            setupInteractions?: boolean;
        }) => {
            // Perform the backend side of the mint
            const { mintTxHash, setupInteractionTxData } =
                await mintProduct(args);

            // Then perform the blockchain side of the mint
            const { hash: interactionDeployHash } = await sendTx({
                metadata: {
                    context: `Deploying user interactions handler for ${args.name}`,
                },
                tx: {
                    to: addresses.contentInteractionManager,
                    value: "0x00",
                    data: setupInteractionTxData,
                },
            });
            console.log(`User interactions handler deployed for ${args.name}`, {
                hash: interactionDeployHash,
            });

            return {
                mintTxHash,
                interactionDeployHash,
            };
        },
    });
}
