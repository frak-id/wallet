"use server";

import { getSafeSession } from "@/context/auth/actions/session";
import { getCampaignRepository } from "@/context/campaigns/repository/CampaignRepository";
import { contentInteractionManagerAbi } from "@frak-labs/shared/context/blockchain/abis/frak-interaction-abis";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
import { ObjectId } from "mongodb";
import { type Address, encodeFunctionData, isAddressEqual } from "viem";

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

/**
 * Function used to delete a campaign
 * @param campaignId
 * @param string
 */
export async function deleteCampaign({ campaignId }: { campaignId: string }) {
    const session = await getSafeSession();
    const campaignRepository = await getCampaignRepository();
    const id = ObjectId.createFromHexString(campaignId);

    // Get the campaign
    const campaign = await campaignRepository.getOneById(id);

    if (!campaign) {
        throw new Error("Campaign not found");
    }

    // Ensure it's the creator of this campaign
    if (!isAddressEqual(campaign.creator, session.wallet)) {
        throw new Error("You can only delete your own campaigns");
    }

    // todo: Check if we will need to perform a on-chain deletion
    // todo: If yes, build the calldata to withdraw the tokens and detach the campaign
    if (campaign.state.key === "created") {
        throw new Error("Cannot delete a deployed campaign yet");
    }

    // Delete the campaign
    await campaignRepository.delete(id);
}
