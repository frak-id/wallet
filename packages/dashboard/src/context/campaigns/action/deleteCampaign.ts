"use server";

import { getSafeSession } from "@/context/auth/actions/session";
import { getAttachedCampaigns } from "@/context/campaigns/action/getAttachedCampaigns";
import { getCampaignRepository } from "@/context/campaigns/repository/CampaignRepository";
import { referralCampaignAbi } from "@frak-labs/shared/context/blockchain/abis/frak-campaign-abis";
import { contentInteractionManagerAbi } from "@frak-labs/shared/context/blockchain/abis/frak-interaction-abis";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
import { ObjectId } from "mongodb";
import { encodeFunctionData, isAddressEqual } from "viem";

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

    // If the campaign isn't attached, we can just delete it and return
    if (campaign.state.key !== "created") {
        await campaignRepository.delete(id);
        return { key: "success" } as const;
    }

    // Check if the campaign is attached or not
    const campaignAddress = campaign.state.address;
    const activeCampaigns = await getAttachedCampaigns({
        contentId: campaign.contentId,
    });
    console.log("Active campaigns", { activeCampaigns, campaignAddress });

    // Check if it's in the active ones
    const isActive =
        activeCampaigns.findIndex((a) => isAddressEqual(a, campaignAddress)) !==
        -1;

    // If it's active, return the call-data required to detach the campaign
    if (isActive) {
        return {
            key: "require-onchain-delete",
            calls: [
                // Withdraw tokens from the campaigns
                {
                    to: campaignAddress,
                    data: encodeFunctionData({
                        abi: referralCampaignAbi,
                        functionName: "withdraw",
                    }),
                    value: "0x00",
                },
                // Detach the campaign
                {
                    to: addresses.contentInteractionManager,
                    data: encodeFunctionData({
                        abi: contentInteractionManagerAbi,
                        functionName: "detachCampaigns",
                        args: [BigInt(campaign.contentId), [campaignAddress]],
                    }),
                    value: "0x00",
                },
            ],
        } as const;
    }

    // Otherwise, just delete it
    await campaignRepository.delete(id);
    return { key: "success" } as const;
}
