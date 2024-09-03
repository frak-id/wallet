import { viemClient } from "@/context/blockchain/provider";
import { productRegistryAbi } from "@frak-labs/shared/context/blockchain/abis/frak-registry-abis";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
import { useQuery } from "@tanstack/react-query";
import { readContract } from "viem/actions";

/**
 * Hook to get the product metadata
 */
export function useProduct({ productId }: { productId: string }) {
    return useQuery({
        queryKey: ["product", productId],
        queryFn: () =>
            readContract(viemClient, {
                address: addresses.productRegistry,
                abi: productRegistryAbi,
                functionName: "getMetadata",
                args: [BigInt(productId)],
            }),
    });
}
