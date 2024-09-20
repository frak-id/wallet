import { viemClient } from "@/context/blockchain/provider";
import { decodeProductTypesMask } from "@/module/product/utils/productTypes";
import { addresses, productRegistryAbi } from "@frak-labs/app-essentials";
import { useQuery } from "@tanstack/react-query";
import type { Hex } from "viem";
import { readContract } from "viem/actions";

/**
 * Hook to get the product metadata
 */
export function useProductMetadata({ productId }: { productId: Hex }) {
    return useQuery({
        queryKey: ["product", "metadata", productId],
        queryFn: async () => {
            const metadata = await readContract(viemClient, {
                address: addresses.productRegistry,
                abi: productRegistryAbi,
                functionName: "getMetadata",
                args: [BigInt(productId)],
            });
            return {
                ...metadata,
                productTypes: decodeProductTypesMask(metadata.productTypes),
            };
        },
    });
}
