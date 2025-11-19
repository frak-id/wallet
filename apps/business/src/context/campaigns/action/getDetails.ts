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
import { authMiddleware } from "@/context/auth/authMiddleware";
import { viemClient } from "@/context/blockchain/provider";
import {
    getCampaignDetailsMock,
    getOnChainCampaignsDetailsMock,
} from "@/context/campaigns/action/mock";
import { getCampaignRepository } from "@/context/campaigns/repository/CampaignRepository";

/**
 * Fetch the campaign details from mongodb
 */
async function getCampaignDetailsInternal({
    campaignId,
    isDemoMode,
}: {
    campaignId: string;
    isDemoMode: boolean;
}) {
    // Check if demo mode is active
    if (isDemoMode) {
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
    wallet,
    isDemoMode,
}: {
    campaignAddress: Address;
    wallet: Address;
    isDemoMode: boolean;
}) {
    // Check if demo mode is active
    if (isDemoMode) {
        return getOnChainCampaignsDetailsMock({ campaignAddress });
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
                args: [BigInt(productId), wallet, productRoles.campaignManager],
            } as const,
            {
                abi: productAdministratorRegistryAbi,
                address: addresses.productAdministratorRegistry,
                functionName: "hasAllRolesOrOwner",
                args: [
                    BigInt(productId),
                    wallet,
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
    .middleware([authMiddleware])
    .inputValidator((input: { campaignId: string }) => input)
    .handler(async ({ data, context }) => {
        const { isDemoMode } = context;
        return getCampaignDetailsInternal({
            campaignId: data.campaignId,
            isDemoMode,
        });
    });

/**
 * Server function to get on-chain campaign details
 */
export const getOnChainCampaignsDetails = createServerFn({ method: "GET" })
    .middleware([authMiddleware])
    .inputValidator((input: { campaignAddress: Address }) => input)
    .handler(async ({ data, context }) => {
        const { wallet, isDemoMode } = context;
        return getOnChainCampaignsDetailsInternal({
            campaignAddress: data.campaignAddress,
            wallet,
            isDemoMode,
        });
    });
