"use server";

import { getSafeSession } from "@/context/auth/actions/session";
import { viemClient } from "@/context/blockchain/provider";
import { getCampaignRepository } from "@/context/campaigns/repository/CampaignRepository";
import {
    addresses,
    interactionCampaignAbi,
    productAdministratorRegistryAbi,
    productRoles,
    referralCampaignAbi,
} from "@frak-labs/app-essentials";
import { ObjectId } from "mongodb";
import { type Address, toHex } from "viem";
import { multicall, readContract } from "viem/actions";

/**
 * Fetch the campaign details from mongodb
 */
export async function getCampaignDetails({
    campaignId,
}: { campaignId: string }) {
    const campaignRepository = await getCampaignRepository();
    return await campaignRepository.getOneById(
        ObjectId.createFromHexString(campaignId)
    );
}

/**
 * Get on chain details for a campaign
 * @param address
 */
export async function getOnChainCampaignsDetails({
    campaignAddress,
}: { campaignAddress: Address }) {
    const session = await getSafeSession();

    // Get the campaign product id
    const [productId, ,] = await readContract(viemClient, {
        abi: interactionCampaignAbi,
        address: campaignAddress,
        functionName: "getLink",
        args: [],
    });

    // Fetch a few onchain information
    const [
        metadata,
        isActive,
        isRunning,
        isCampaignManager,
        isProductAdministrator,
        config,
    ] = await multicall(viemClient, {
        contracts: [
            {
                abi: interactionCampaignAbi,
                address: campaignAddress,
                functionName: "getMetadata",
                args: [],
            } as const,
            {
                abi: interactionCampaignAbi,
                address: campaignAddress,
                functionName: "isActive",
                args: [],
            } as const,
            {
                abi: interactionCampaignAbi,
                address: campaignAddress,
                functionName: "isRunning",
                args: [],
            } as const,
            {
                abi: productAdministratorRegistryAbi,
                address: addresses.productAdministratorRegistry,
                functionName: "hasAllRolesOrOwner",
                args: [
                    BigInt(productId),
                    session.wallet,
                    productRoles.campaignManager,
                ],
            } as const,
            {
                abi: productAdministratorRegistryAbi,
                address: addresses.productAdministratorRegistry,
                functionName: "hasAllRolesOrOwner",
                args: [
                    BigInt(productId),
                    session.wallet,
                    productRoles.productAdministrator,
                ],
            } as const,
            {
                abi: referralCampaignAbi,
                address: campaignAddress,
                functionName: "getConfig",
                args: [],
            } as const,
        ],
        allowFailure: false,
    });

    // Return the data
    return {
        productId: toHex(productId),
        metadata,
        isActive,
        isRunning,
        isAllowedToEdit: isCampaignManager || isProductAdministrator,
        config,
    };
}
