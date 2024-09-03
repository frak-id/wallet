import { useWaitForTxAndInvalidateQueries } from "@/module/common/utils/useWaitForTxAndInvalidateQueries";
import { useSendTransactionAction } from "@frak-labs/nexus-sdk/react";
import { productRegistryAbi } from "@frak-labs/shared/context/blockchain/abis/frak-registry-abis";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
import { useMutation } from "@tanstack/react-query";
import { encodeFunctionData } from "viem";

type ProductEditParams = {
    productTypes: string;
    name: string;
};

/**
 * Hook to edit product metadata
 */
export function useEditProduct({ productId }: { productId: string }) {
    const { mutateAsync: sendTransaction } = useSendTransactionAction();
    const waitForTxAndInvalidateQueries = useWaitForTxAndInvalidateQueries();

    return useMutation({
        mutationKey: ["product", "edit", productId],
        mutationFn: async ({ productTypes, name }: ProductEditParams) => {
            // Build the transaction data
            const txData = encodeFunctionData({
                abi: productRegistryAbi,
                functionName: "updateMetadata",
                args: [BigInt(productId), BigInt(productTypes), name],
            });

            // Send the transaction
            const { hash } = await sendTransaction({
                tx: {
                    to: addresses.productAdministratorRegistry,
                    data: txData,
                },
                metadata: {
                    header: {
                        title: "Update product",
                    },
                    context: "Change product name and type",
                },
            });

            // Wait a bit for the tx to be confirmed
            await waitForTxAndInvalidateQueries({
                hash,
                queryKey: ["product", productId],
            });

            return { hash };
        },
    });
}
