import { useWaitForTxAndInvalidateQueries } from "@/module/common/utils/useWaitForTxAndInvalidateQueries";
import { encodeProductTypesMask } from "@/module/product/utils/productTypes";
import {
    addresses,
    productRegistryAbi,
    stringToBytes32,
} from "@frak-labs/app-essentials";
import type { ProductTypesKey } from "@frak-labs/core-sdk";
import { useSendTransactionAction } from "@frak-labs/react-sdk";
import { useMutation } from "@tanstack/react-query";
import { type Hex, encodeFunctionData } from "viem";

type ProductEditParams = {
    productTypes: ProductTypesKey[];
    name: string;
};

/**
 * Hook to edit product metadata
 */
export function useEditProduct({ productId }: { productId: Hex }) {
    const { mutateAsync: sendTransaction } = useSendTransactionAction();
    const waitForTxAndInvalidateQueries = useWaitForTxAndInvalidateQueries();

    return useMutation({
        mutationKey: ["product", "edit", productId],
        mutationFn: async ({ productTypes, name }: ProductEditParams) => {
            // Build the transaction data
            const txData = encodeFunctionData({
                abi: productRegistryAbi,
                functionName: "updateMetadata",
                args: [
                    BigInt(productId),
                    encodeProductTypesMask(productTypes),
                    stringToBytes32(name),
                    "",
                ],
            });

            // Send the transaction
            const { hash } = await sendTransaction({
                tx: {
                    to: addresses.productRegistry,
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
