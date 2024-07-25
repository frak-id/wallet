import { mintMyContent } from "@/context/content/action/mint";
import { useSendTransactionAction } from "@frak-labs/nexus-sdk/react";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
import { useMutation } from "@tanstack/react-query";

/**
 * Hook to mint the user content
 */
export function useMintMyContent() {
    const { mutateAsync: sendTx } = useSendTransactionAction();

    return useMutation({
        mutationKey: ["mint", "launch-initial-mint"],
        mutationFn: async (args: {
            name: string;
            domain: string;
            contentTypes: bigint;
            setupInteractions?: boolean;
        }) => {
            // Perform the backend side of the mint
            const { mintTxHash, setupInteractionTxData } =
                await mintMyContent(args);

            // Then perform the blockchain side of the mint
            console.log(`Minting user content for ${args.name}`, {
                tx: {
                    to: addresses.contentRegistry,
                    value: "0x00",
                    data: setupInteractionTxData,
                },
            });
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

            return {
                mintTxHash,
                interactionDeployHash,
            };
        },
    });
}
