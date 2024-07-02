"use server";

import { contentInteractionManagerAbi } from "@frak-labs/shared/context/blockchain/abis/frak-interaction-abis";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
import { type Address, encodeFunctionData } from "viem";

/**
 * Delete a campaign around the given content
 *  todo: This is a tx call that should trigger a tx, how to trigger tx on the nexus?
 *   - Maybe back to the wallet connect implementation?
 *   - Or maybe use wallet connect screen with some SDK screens, and stuff passed in the calldata?
 */
export async function deleteCampaignsCallData({
    contentId,
    campaigns,
}: { contentId: bigint; campaigns: Address[] }) {
    const calldata = encodeFunctionData({
        abi: contentInteractionManagerAbi,
        functionName: "detachCampaigns",
        args: [contentId, campaigns],
    });
    return {
        to: addresses.contentInteractionManager,
        data: calldata,
    };
}
