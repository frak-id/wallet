"use server";

import { getSafeSession } from "@/context/auth/actions/session";
import { viemClient } from "@/context/blockchain/provider";
import { getCampaignRepository } from "@/context/campaigns/repository/CampaignRepository";
import type { CampaignWithState } from "@/types/Campaign";
import {
    addresses,
    interactionCampaignAbi,
    productAdministratorRegistryAbi,
    productRoles,
} from "@frak-labs/app-essentials";
import { indexerApi } from "@frak-labs/shared/context/server";
import { all, sift, unique } from "radash";
import { type Address, getAddress, isAddress, isAddressEqual } from "viem";
import { multicall } from "viem/actions";

type ApiResult = {
    productId: string;
    isOwner: boolean;
    id: Address;
    name: string;
    version: string;
    attached: boolean;
    // bigint, time is second
    attachTimestamp: string;
    detachTimestamp?: string | null;
}[];

/**
 * Get the current user campaigns
 */
export async function getMyCampaigns(): Promise<CampaignWithState[]> {
    const session = await getSafeSession();

    // Perform the request to our api, and fallback to empty array
    const blockchainCampaigns =
        (await indexerApi
            .get(`admin/${session.wallet}/campaigns`)
            .json<ApiResult>()) ?? [];

    // Find the campaigns in the database
    const repository = await getCampaignRepository();
    const campaignDocuments = await repository.findByAddressesOrCreator({
        addresses: blockchainCampaigns.map((campaign) => campaign.id),
        creator: session.wallet,
    });

    // Create the state of unique addresses we will fetch
    const campaignAddresses = sift(
        unique(
            [
                ...campaignDocuments.map((campaign) =>
                    campaign.state.key === "created"
                        ? campaign.state.address
                        : null
                ),
                ...blockchainCampaigns.map((campaign) => campaign.id),
            ],
            (a) =>
                a && isAddress(a, { strict: false }) ? getAddress(a) : "unknown"
        )
    );

    const campaignProductIds = sift(
        campaignAddresses.map((address) => {
            const campaign = blockchainCampaigns.find((item) =>
                isAddressEqual(item.id, address)
            );
            if (campaign)
                return {
                    address,
                    productId: BigInt(campaign.productId),
                };
            const document = campaignDocuments.find(
                (item) =>
                    item.state.key === "created" &&
                    isAddressEqual(item.state.address, address)
            );
            if (document?.productId)
                return {
                    address,
                    productId: BigInt(document.productId),
                };
            return null;
        })
    );

    // Fetch the onchain state for each campaign
    const onChainStates = await getOnChainStateForCampaigns({
        campaignProductIds,
        wallet: session.wallet,
    });

    // Map all of that to campaign with state object
    return campaignDocuments.map((campaign) => {
        // Build initial campaign based on off-chain data
        const isOffchainCreator = isAddressEqual(
            campaign.creator,
            session.wallet
        );
        const mappedCampaign = {
            ...campaign,
            _id: campaign._id.toHexString(),
            actions: {
                canEdit: campaign.state.key === "draft",
                canDelete: isOffchainCreator,
                canToggleRunningStatus: false,
            },
        };

        // If the campaign is not created, return it as is
        const state = campaign.state;
        if (state.key !== "created") {
            // Update the mapped campaign to disallow edit if in state creationFailed
            mappedCampaign.actions.canEdit = state.key !== "creationFailed";
            // And return it
            return mappedCampaign as CampaignWithState;
        }

        // Find the blockchain campaign for this campaign
        const blockchainCampaign = blockchainCampaigns.find((item) =>
            isAddressEqual(item.id, state.address)
        );
        if (!blockchainCampaign) {
            return mappedCampaign as CampaignWithState;
        }
        const onChainState = onChainStates.find((item) =>
            isAddressEqual(item.address, blockchainCampaign.id)
        );

        // Update the edit state depending on it
        mappedCampaign.actions.canEdit = onChainState?.canEdit ?? false;
        mappedCampaign.actions.canDelete = onChainState?.canEdit ?? false;

        // And return it
        return {
            ...mappedCampaign,
            state: {
                ...state,
                interactionLink: {
                    isAttached: blockchainCampaign.attached,
                    attachTimestamp: blockchainCampaign.attachTimestamp,
                    detachTimestamp:
                        blockchainCampaign.detachTimestamp ?? undefined,
                },
                isActive: onChainState?.isActive ?? false,
                isRunning: onChainState?.isRunning ?? false,
            },
            actions: {
                ...mappedCampaign.actions,
                canToggleRunningStatus: onChainState?.canEdit ?? false,
            },
        } as CampaignWithState;
    });
}

/**
 * Get the onchain state for each campaign address
 */
async function getOnChainStateForCampaigns({
    campaignProductIds,
    wallet,
}: {
    campaignProductIds: { address: Address; productId: bigint }[];
    wallet: Address;
}): Promise<
    {
        address: Address;
        canEdit: boolean;
        isActive: boolean;
        isRunning: boolean;
    }[]
> {
    // If no address provided, early exit
    if (campaignProductIds.length === 0) {
        return [];
    }

    const baseMulticallParams = {
        abi: interactionCampaignAbi,
        args: [],
    } as const;

    // Otherwise, fetch the state for each address
    const { isActives, canEdits, isRunnings } = await all({
        // Check if the campaign is active
        isActives: multicall(viemClient, {
            contracts: campaignProductIds.map(
                ({ address }) =>
                    ({
                        ...baseMulticallParams,
                        address,
                        functionName: "isActive",
                    }) as const
            ),
            allowFailure: false,
        }),
        // Check if the campaign can be edited
        canEdits: multicall(viemClient, {
            contracts: campaignProductIds.map(
                ({ productId }) =>
                    ({
                        abi: productAdministratorRegistryAbi,
                        address: addresses.productAdministratorRegistry,
                        functionName: "hasAllRolesOrOwner",
                        args: [productId, wallet, productRoles.campaignManager],
                    }) as const
            ),
            allowFailure: false,
        }),
        // Check if the campaign can be edited
        isRunnings: multicall(viemClient, {
            contracts: campaignProductIds.map(
                ({ address }) =>
                    ({
                        ...baseMulticallParams,
                        address,
                        functionName: "isRunning",
                    }) as const
            ),
            allowFailure: false,
        }),
    });

    // Map the results to an object
    return campaignProductIds.reduce(
        (acc, { address }, index) => {
            acc.push({
                address,
                canEdit: canEdits[index],
                isActive: isActives[index],
                isRunning: isRunnings[index],
            });
            return acc;
        },
        [] as {
            address: Address;
            canEdit: boolean;
            isActive: boolean;
            isRunning: boolean;
        }[]
    );
}
