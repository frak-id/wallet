"use server";
import { viemClient } from "@/context/blockchain/provider";
import {
    contentInteractionDiamondAbi,
    contentInteractionManagerAbi,
} from "@frak-labs/shared/context/blockchain/abis/frak-interaction-abis";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
import { readContract } from "viem/actions";

/**
 * Get all the attached campaigns on a product
 * @param contentId
 */
export async function getAttachedCampaigns({
    contentId,
}: { contentId: string }) {
    // Get the root interaction contract
    const contentInteraction = await readContract(viemClient, {
        address: addresses.contentInteractionManager,
        abi: contentInteractionManagerAbi,
        functionName: "getInteractionContract",
        args: [BigInt(contentId)],
    });
    // Get the current product campaigns
    return readContract(viemClient, {
        address: contentInteraction,
        abi: contentInteractionDiamondAbi,
        functionName: "getCampaigns",
    });
}
