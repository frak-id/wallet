import {
    addresses,
    interactionCampaignAbi,
    productAdministratorRegistryAbi,
    productRoles,
    referralCampaignAbi,
} from "@frak-labs/app-essentials";
import { createServerFn } from "@tanstack/react-start";
import { ObjectId } from "mongodb";
import { type Address, toHex } from "viem";
import { multicall, readContract } from "viem/actions";
import { getSession } from "@/context/auth/session";
import { viemClient } from "@/context/blockchain/provider";
import {
    getCampaignDetailsMock,
    getOnChainCampaignsDetailsMock,
} from "@/context/campaigns/action/mock";
import { getCampaignRepository } from "@/context/campaigns/repository/CampaignRepository";
import { isDemoModeActive } from "@/module/common/utils/isDemoMode";

/**
 * Fetch the campaign details from mongodb
 */
async function getCampaignDetailsInternal({
    campaignId,
}: {
    campaignId: string;
}) {
    // Check if demo mode is active
    if (await isDemoModeActive()) {
        return getCampaignDetailsMock({ campaignId });
    }

    const campaignRepository = await getCampaignRepository();
    const campaignDb = await campaignRepository.getOneById(
        ObjectId.createFromHexString(campaignId)
    );
    if (!campaignDb) {
        return null;
    }
    return {
        ...campaignDb,
        // Remove ObjectId properties
        _id: undefined,
        // Send back the id in the id field
        id: campaignDb._id.toHexString(),
    };
}

/**
 * Get on chain details for a campaign
 * @param address
 */
async function getOnChainCampaignsDetailsInternal({
    campaignAddress,
}: {
    campaignAddress: Address;
}) {
    // Check if demo mode is active
    if (await isDemoModeActive()) {
        return getOnChainCampaignsDetailsMock({ campaignAddress });
    }

    const session = await getSession();
    if (!session) {
        throw new Error("No current session found");
    }

    // Get the campaign product id
    const [productId, ,] = await readContract(viemClient, {
        abi: interactionCampaignAbi,
        address: campaignAddress,
        functionName: "getLink",
        args: [],
    });

    // Fetch a few generic onchain information
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

/**
 * Server function to fetch campaign details
 */
export const getCampaignDetails = createServerFn({ method: "GET" })
    .inputValidator((input: { campaignId: string }) => input)
    .handler(async ({ data }) => {
        return getCampaignDetailsInternal({ campaignId: data.campaignId });
    });

/**
 * Server function to get on-chain campaign details
 */
export const getOnChainCampaignsDetails = createServerFn({ method: "GET" })
    .inputValidator((input: { campaignAddress: Address }) => input)
    .handler(async ({ data }) => {
        return getOnChainCampaignsDetailsInternal({
            campaignAddress: data.campaignAddress,
        });
    });
