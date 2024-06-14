"use server";

import { interactionCampaignAbi } from "@/context/blockchain/abis/frak-campaign-abis";
import {
    contentInteractionDiamondAbi,
    contentInteractionManagerAbi,
} from "@/context/blockchain/abis/frak-interaction-abis";
import { addresses } from "@/context/blockchain/addresses";
import { viemClient } from "@/context/blockchain/provider";
import type { Address } from "viem";
import { multicall, readContract } from "viem/actions";

/**
 * Get all the interaction contracts address for the given content ids
 * todo: Should be cached for at least 12hr
 * @param contentIds
 */
async function getInteractionContract({ contentId }: { contentId: bigint }) {
    return readContract(viemClient, {
        address: addresses.contentInteractionManager,
        abi: contentInteractionManagerAbi,
        functionName: "getInteractionContract",
        args: [contentId],
    });
}

/**
 * Get all the interaction contracts address for the given content ids
 * todo: Should be cached for 15min
 * @param contentIds
 */
export async function getCurrentCampaigns({
    contentId,
}: { contentId: bigint }): Promise<
    { address: Address; name: string; version: string }[]
> {
    // Fetch the interaction contract
    const interactionContract = await getInteractionContract({ contentId });

    // Fetch all campaigns
    const campaigns = await readContract(viemClient, {
        address: interactionContract,
        abi: contentInteractionDiamondAbi,
        functionName: "getCampaigns",
    });

    // For each campaigns, check their types
    const compainsNameAndVersion = await multicall(viemClient, {
        contracts: campaigns.map(
            (campaign) =>
                ({
                    address: campaign,
                    abi: interactionCampaignAbi,
                    functionName: "getMetadata",
                }) as const
        ),
        allowFailure: false,
    });

    // Return all of that data mapped (address -> name and version)
    return campaigns.map((address, index) => ({
        address,
        name: compainsNameAndVersion[index][0],
        version: compainsNameAndVersion[index][1],
    }));
}
