"use server";

import { frakChainPocClient } from "@/context/blockchain/provider";
import { contentInteractionManagerAbi } from "@frak-labs/shared/context/blockchain/abis/frak-interaction-abis";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
import { readContract } from "viem/actions";

/**
 * Get all the interaction contracts address for the given content ids
 * @param contentIds
 */
export async function getInteractionContract({
    contentId,
}: { contentId: bigint }) {
    return readContract(frakChainPocClient, {
        address: addresses.contentInteractionManager,
        abi: contentInteractionManagerAbi,
        functionName: "getInteractionContract",
        args: [contentId],
    });
}
