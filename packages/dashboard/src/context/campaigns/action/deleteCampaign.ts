"use server";

import { getSafeSession } from "@/context/auth/actions/session";
import { viemClient } from "@/context/blockchain/provider";
import { getAttachedCampaigns } from "@/context/campaigns/action/getAttachedCampaigns";
import { getCampaignRepository } from "@/context/campaigns/repository/CampaignRepository";
import {
    addresses,
    productInteractionManagerAbi,
    productRoles,
} from "@frak-labs/app-essentials";
import {
    campaignBankAbi,
    productAdministratorRegistryAbi,
} from "@frak-labs/app-essentials/blockchain";
import { ObjectId } from "mongodb";
import {
    type Address,
    type Hex,
    encodeFunctionData,
    isAddressEqual,
} from "viem";
import { readContract } from "viem/actions";

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
    const productId = campaign.productId as string | undefined;
    if (!productId) {
        throw new Error("Product ID is required");
    }

    // Check if the campaign is attached or not
    const campaignAddress = campaign.state.address;
    const activeCampaigns = await getAttachedCampaigns({
        productId,
    });
    console.log("Active campaigns", { activeCampaigns, campaignAddress });

    // Check if it's in the active ones
    const isActive =
        activeCampaigns.findIndex((a) => isAddressEqual(a, campaignAddress)) !==
        -1;

    // If it's active, return the call-data required to detach the campaign
    if (isActive) {
        // Check if the user is a product manager (if yes disallow banking from the campaign)
        const isProductManager = await readContract(viemClient, {
            address: addresses.productAdministratorRegistry,
            abi: productAdministratorRegistryAbi,
            functionName: "hasAllRolesOrOwner",
            args: [
                BigInt(productId),
                session.wallet,
                productRoles.interactionManager,
            ],
        });

        const calls = [
            // Detach the campaign
            {
                to: addresses.productInteractionManager as Address,
                data: encodeFunctionData({
                    abi: productInteractionManagerAbi,
                    functionName: "detachCampaigns",
                    args: [BigInt(productId), [campaignAddress]],
                }),
                value: "0x00" as Hex,
            },
        ];

        if (isProductManager) {
            calls.push({
                to: campaignAddress,
                data: encodeFunctionData({
                    abi: campaignBankAbi,
                    functionName: "updateCampaignAuthorisation",
                    args: [campaignAddress, false],
                }),
                value: "0x00",
            });
        }

        return {
            key: "require-onchain-delete",
            calls,
        } as const;
    }

    // Otherwise, just delete it
    await campaignRepository.delete(id);
    return { key: "success" } as const;
}
