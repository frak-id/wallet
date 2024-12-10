import { currentViemClient } from "@/context/blockchain/provider";
import { listenerProductIdAtom } from "@/module/listener/atoms/listenerContext";
import { addresses, productRegistryAbi } from "@frak-labs/app-essentials";
import {
    type ProductTypesKey,
    productTypesMask,
} from "@frak-labs/nexus-sdk/core";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import type { Hex } from "viem";
import { readContract } from "viem/actions";

/**
 * The query data to get the product metadata
 * @param productId
 */
export const getProductMetadataQuery = ({ productId }: { productId?: Hex }) => {
    return {
        enabled: !!productId,
        queryKey: ["product", "get-metadata", productId ?? "no-product-id"],
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
    };
};

/**
 * Fetch the current product metadata
 */
export function useGetProductMetadata() {
    const listenerProductId = useAtomValue(listenerProductIdAtom);

    const { data, ...query } = useQuery(
        getProductMetadataQuery({
            productId: listenerProductId,
        })
    );

    return {
        ...query,
        metadata: data,
    };
}
