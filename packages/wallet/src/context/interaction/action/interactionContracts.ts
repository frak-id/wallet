"use server";

import { frakChainPocClient } from "@/context/blockchain/provider";
import {
    contentInteractionDiamondAbi,
    contentInteractionManagerAbi,
} from "@frak-labs/shared/context/blockchain/abis/frak-interaction-abis";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
import { parallel } from "radash";
import type { Address } from "viem";
import { multicall, readContract } from "viem/actions";

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

/**
 * Get all the interaction contracts address for the given content ids
 * @param contentIds
 */
export async function getCampaignContracts({
    contentId,
}: { contentId: bigint | bigint[] }): Promise<Address[]> {
    // Fetch our interaction contracts
    const interactionContracts: Address[] = [];
    if (Array.isArray(contentId)) {
        await parallel(2, contentId, async (id) => {
            const interactionContract = await getInteractionContract({
                contentId: id,
            });
            interactionContracts.push(interactionContract);
        });
    } else {
        const interactionContract = await getInteractionContract({ contentId });
        interactionContracts.push(interactionContract);
    }

    // Fetch all campaigns
    const campaigns = await multicall(frakChainPocClient, {
        contracts: interactionContracts.map(
            (address) =>
                ({
                    address,
                    abi: contentInteractionDiamondAbi,
                    functionName: "getCampaigns",
                }) as const
        ),
        allowFailure: false,
    });

    // Flatten campaigns
    return campaigns.flat();
}
