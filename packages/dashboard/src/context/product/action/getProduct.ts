"use server";

import { viemClient } from "@/context/blockchain/provider";
import { productRegistryAbi } from "@frak-labs/shared/context/blockchain/abis/frak-registry-abis";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
import { readContract } from "viem/actions";

/**
 * Get the product metadata
 */
export async function getProduct({ productId }: { productId: bigint }) {
    return await readContract(viemClient, {
        address: addresses.productRegistry,
        abi: productRegistryAbi,
        functionName: "getMetadata",
        args: [BigInt(productId)],
    });
}
