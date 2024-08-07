"use server";

import { frakChainPocClient } from "@frak-labs/nexus-wallet/src/context/blockchain/provider";
import {
    contentInteractionDiamondAbi,
    contentInteractionManagerAbi,
} from "@frak-labs/shared/context/blockchain/abis/frak-interaction-abis";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
import { readContract } from "viem/actions";

/**
 * Get all the attached campaigns on a content
 * @param contentId
 */
export async function getAttachedCampaigns({
    contentId,
}: { contentId: string }) {
    // Get the root interaction contract
    const contentInteraction = await readContract(frakChainPocClient, {
        address: addresses.contentInteractionManager,
        abi: contentInteractionManagerAbi,
        functionName: "getInteractionContract",
        args: [BigInt(contentId)],
    });
    // Get the current content campaigns
    return readContract(frakChainPocClient, {
        address: contentInteraction,
        abi: contentInteractionDiamondAbi,
        functionName: "getCampaigns",
    });
}
