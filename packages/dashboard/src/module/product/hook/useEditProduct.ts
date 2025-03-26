import { useWaitForTxAndInvalidateQueries } from "@/module/common/utils/useWaitForTxAndInvalidateQueries";
import { encodeProductTypesMask } from "@/module/product/utils/productTypes";
import {
    addresses,
    productInteractionManagerAbi,
    productRegistryAbi,
    stringToBytes32,
} from "@frak-labs/app-essentials";
import type { ProductTypesKey } from "@frak-labs/core-sdk";
import { useSendTransactionAction } from "@frak-labs/react-sdk";
import { useMutation } from "@tanstack/react-query";
import { type Address, type Hex, encodeFunctionData } from "viem";
import { useProductInteractionContract } from "./useProductInteractionContract";

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
    const { data: interactionContract } = useProductInteractionContract({
        productId,
    });

    return useMutation({
        mutationKey: ["product", "edit", productId],
        mutationFn: async ({ productTypes, name }: ProductEditParams) => {
            // Build the transaction data
            const txs: { to: Address; data: Hex }[] = [];
            txs.push({
                to: addresses.productRegistry,
                data: encodeFunctionData({
                    abi: productRegistryAbi,
                    functionName: "updateMetadata",
                    args: [
                        BigInt(productId),
                        encodeProductTypesMask(productTypes),
                        stringToBytes32(name),
                        "",
                    ],
                }),
            });

            // If the product has an interaction contract, also directly update the product facets
            if (interactionContract) {
                txs.push({
                    to: addresses.productInteractionManager,
                    data: encodeFunctionData({
                        abi: productInteractionManagerAbi,
                        functionName: "updateInteractionContract",
                        args: [BigInt(productId)],
                    }),
                });
            }

            // Send the transaction
            const { hash } = await sendTransaction({
                tx: txs,
                metadata: {
                    header: {
                        title: "Update product",
                    },
                    i18n: {
                        fr: {
                            "sdk.modal.sendTransaction.description":
                                "Changer le nom et le type du produit",
                        },
                        en: {
                            "sdk.modal.sendTransaction.description":
                                "Change product name and type",
                        },
                    },
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
