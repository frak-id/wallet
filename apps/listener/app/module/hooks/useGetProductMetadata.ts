import { addresses, productRegistryAbi } from "@frak-labs/app-essentials";
import { type ProductTypesKey, productTypesMask } from "@frak-labs/core-sdk";
import type { Hex } from "viem";
import { readContract } from "viem/actions";
import { currentViemClient } from "@frak-labs/wallet-shared/blockchain/provider";
import { listenerProductKey } from "@/module/queryKeys/product";

/**
 * The query data to get the product metadata
 * @param productId
 */
export const getProductMetadataQuery = ({
    productId,
}: {
    productId?: Hex;
}) => ({
    enabled: !!productId,
    queryKey: listenerProductKey.metadata.byId(productId),
    async queryFn() {
        if (!productId) {
            return null;
        }

        // Try to read the on chain metadata
        try {
            const onChainMetadata = await readContract(currentViemClient, {
                address: addresses.productRegistry,
                abi: productRegistryAbi,
                functionName: "getMetadata",
                args: [BigInt(productId)],
            });

            // Parse the metadatas
            const productTypes = Object.entries(productTypesMask).reduce(
                (acc, [itemKey, itemMask]) => {
                    if (
                        (onChainMetadata.productTypes & itemMask) ===
                        itemMask
                    ) {
                        acc.push(itemKey as ProductTypesKey);
                    }
                    return acc;
                },
                [] as ProductTypesKey[]
            );

            return {
                id: productId,
                name: onChainMetadata.name,
                domain: onChainMetadata.domain,
                productTypes: productTypes,
            };
        } catch (error) {
            console.warn(
                "Failed to read on chain metadata for the product",
                error
            );
            return null;
        }
    },
});
