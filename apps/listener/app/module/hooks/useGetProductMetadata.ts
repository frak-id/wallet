import { addresses, productRegistryAbi } from "@frak-labs/app-essentials";
import { type ProductTypesKey, productTypesMask } from "@frak-labs/core-sdk";
import { currentViemClient } from "@frak-labs/wallet-shared";
import type { Hex } from "viem";
import { readContract } from "viem/actions";
import { listenerMerchantKey } from "@/module/queryKeys/product";

export const getProductMetadataQuery = ({
    merchantId,
    productId,
}: {
    merchantId?: string;
    productId?: Hex;
}) => ({
    enabled: !!productId,
    queryKey: listenerMerchantKey.metadata.byId(merchantId),
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
