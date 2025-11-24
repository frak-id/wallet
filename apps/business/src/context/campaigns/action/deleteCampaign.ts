import {
    addresses,
    affiliationFixedCampaignAbi,
    productInteractionManagerAbi,
} from "@frak-labs/app-essentials";
import { createServerFn } from "@tanstack/react-start";
import { ObjectId } from "mongodb";
import { type Address, encodeFunctionData, isAddressEqual } from "viem";
import { authMiddleware } from "@/context/auth/authMiddleware";
import { getAttachedCampaigns } from "@/context/campaigns/action/getAttachedCampaigns";
import { getCampaignRepository } from "@/context/campaigns/repository/CampaignRepository";
import { getRolesOnProduct } from "@/context/product/action/roles";

/**
 * Function used to delete a campaign
 * @param campaignId
 * @param string
 */
async function deleteCampaignInternal({
    campaignId,
    wallet,
}: {
    campaignId: string;
    wallet: Address;
}) {
    const campaignRepository = await getCampaignRepository();
    const id = ObjectId.createFromHexString(campaignId);

    // Get the campaign
    const campaign = await campaignRepository.getOneById(id);
    if (!campaign) {
        throw new Error("Campaign not found");
    }

    // Ensure the user is allowed on to manage campaign on this product
    const roles = await getRolesOnProduct({
        data: { productId: campaign.productId },
    });
    const isAllowed =
        (roles?.isCampaignManager ?? false) ||
        isAddressEqual(campaign.creator, wallet);
    if (!isAllowed) {
        throw new Error("You can only delete your own campaigns");
    }

    // If the campaign isn't attached, we can just delete it and return
    if (campaign.state.key !== "created") {
        await campaignRepository.delete(id);
        return { key: "success" } as const;
    }
    const productId = campaign.productId as string | undefined;
    if (!productId) {
        throw new Error("Product ID is required");
    }

    // Check if the campaign is attached or not
    const campaignAddress = campaign.state.address;
    const activeCampaigns = await getAttachedCampaigns({
        data: { productId },
    });

    // Check if it's in the active ones
    const isActive =
        activeCampaigns.findIndex((a) => isAddressEqual(a, campaignAddress)) !==
        -1;

    // If it's active, return the call-data required to detach the campaign
    if (isActive) {
        const tx = [
            // Set the campaign to not running
            {
                to: campaignAddress,
                data: encodeFunctionData({
                    abi: affiliationFixedCampaignAbi,
                    functionName: "setRunningStatus",
                    args: [false],
                }),
            },
            // Detach the campaign
            {
                to: addresses.productInteractionManager as Address,
                data: encodeFunctionData({
                    abi: productInteractionManagerAbi,
                    functionName: "detachCampaigns",
                    args: [BigInt(productId), [campaignAddress]],
                }),
            },
            // todo: update the campaign authorization on the banking contract
        ];

        return {
            key: "require-onchain-delete",
            tx,
        } as const;
    }

    // Otherwise, just delete it
    await campaignRepository.delete(id);
    return { key: "success" } as const;
}

/**
 * Server function to delete a campaign
 */
export const deleteCampaign = createServerFn({ method: "POST" })
    .middleware([authMiddleware])
    .inputValidator((input: { campaignId: string }) => input)
    .handler(async ({ data, context }) => {
        const { wallet } = context;
        return deleteCampaignInternal({ campaignId: data.campaignId, wallet });
    });
