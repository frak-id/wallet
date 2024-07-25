"use server";

import { getSafeSession } from "@/context/auth/actions/session";
import { campaignRoles } from "@/context/blockchain/roles";
import { getCampaignRepository } from "@/context/campaigns/repository/CampaignRepository";
import { frakChainPocClient } from "@frak-labs/nexus-wallet/src/context/blockchain/provider";
import { interactionCampaignAbi } from "@frak-labs/shared/context/blockchain/abis/frak-campaign-abis";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
import { ObjectId } from "mongodb";
import { type Address, erc20Abi } from "viem";
import { multicall } from "viem/actions";

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

    // Fetch a few onchain information
    const [metadata, isActive, isAllowedToEdit, balance] = await multicall(
        frakChainPocClient,
        {
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
                    functionName: "hasAnyRole",
                    args: [session.wallet, BigInt(campaignRoles.manager)],
                } as const,
                {
                    abi: erc20Abi,
                    address: addresses.mUsdToken,
                    functionName: "balanceOf",
                    args: [campaignAddress],
                } as const,
            ],
            allowFailure: false,
        }
    );

    // Return the data
    return {
        metadata,
        isActive,
        isAllowedToEdit,
        balance,
    };
}
