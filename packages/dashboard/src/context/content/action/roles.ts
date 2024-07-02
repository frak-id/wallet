"use server";

import { viemClient } from "@/context/blockchain/provider";
import { contentRegistryAbi } from "@frak-labs/shared/context/blockchain/abis/frak-registry-abis";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
import type { Address } from "viem";
import { readContract } from "viem/actions";

/**
 * Check if the given wallet is allowed tro manage a content
 * @param wallet
 * @param contentId
 */
export async function isAllowedOnContent({
    wallet,
    contentId,
}: { wallet: Address; contentId: bigint }) {
    return await readContract(viemClient, {
        abi: contentRegistryAbi,
        address: addresses.contentRegistry,
        functionName: "isAuthorized",
        args: [contentId, wallet],
    });
}
