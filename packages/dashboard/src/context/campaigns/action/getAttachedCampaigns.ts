"use server";
import { viemClient } from "@/context/blockchain/provider";
import {
    addresses,
    productInteractionDiamondAbi,
    productInteractionManagerAbi,
} from "@frak-labs/constant";
import { readContract } from "viem/actions";

/**
 * Get all the attached campaigns on a product
 * @param productId
 */
export async function getAttachedCampaigns({
    productId,
}: { productId: string }) {
    // Get the root interaction contract
    const interactionContract = await readContract(viemClient, {
        address: addresses.productInteractionManager,
        abi: productInteractionManagerAbi,
        functionName: "getInteractionContract",
        args: [BigInt(productId)],
    });
    // Get the current product campaigns
    return readContract(viemClient, {
        address: interactionContract,
        abi: productInteractionDiamondAbi,
        functionName: "getCampaigns",
    });
}
