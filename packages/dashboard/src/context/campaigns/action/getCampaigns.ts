"use server";

import { getSafeSession } from "@/context/auth/actions/session";
import { viemClient } from "@/context/blockchain/provider";
import { roles } from "@/context/blockchain/roles";
import { getCampaignRepository } from "@/context/campaigns/repository/CampaignRepository";
import type { CampaignWithState } from "@/types/Campaign";
import { interactionCampaignAbi } from "@frak-labs/shared/context/blockchain/abis/frak-campaign-abis";
import { productAdministratorRegistryAbi } from "@frak-labs/shared/context/blockchain/abis/frak-registry-abis";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
import ky from "ky";
import { all, sift } from "radash";
import { type Address, type Hex, isAddressEqual } from "viem";
import { multicall } from "viem/actions";

type ApiResult = {
    productId: string;
    isOwner: number; // bool
    id: Address;
    name: string;
    version: string;
    attached: number;
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
        (await ky
            .get(`https://indexer.frak.id/admin/${session.wallet}/campaigns`)
            .json<ApiResult>()) ?? [];

    // Find the campaigns in the database
    const repository = await getCampaignRepository();
    const campaignDocuments = await repository.findByAddressesOrCreator({
        addresses: blockchainCampaigns.map((campaign) => campaign.id),
        creator: session.wallet,
    });

    // Create the state of unique addresses we will fetch
    const campaignAddresses = new Set<Address>([
        ...sift(
            campaignDocuments.map((campaign) =>
                campaign.state.key === "created" ? campaign.state.address : null
            )
        ),
        ...blockchainCampaigns.map((campaign) => campaign.id),
    ]);

    const campaignProductIds = sift(
        [...campaignAddresses].map((address) => {
            const campaign = blockchainCampaigns.find((item) =>
                isAddressEqual(item.id, address)
            );
            if (campaign)
                return {
                    address,
                    productId: campaign.productId,
                };
            const document = campaignDocuments.find(
                (item) =>
                    item.state.key === "created" &&
                    isAddressEqual(item.state.address, address)
            );
            if (document)
                return {
                    address,
                    productId: document.productId,
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
        const onChainState = onChainStates[blockchainCampaign.id];

        // Update the edit state depending on it
        mappedCampaign.actions.canEdit = onChainState?.canEdit ?? false;

        // And return it
        return {
            ...mappedCampaign,
            state: {
                ...state,
                interactionLink: {
                    isAttached: blockchainCampaign.attached === 1,
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
    campaignProductIds: { address: Address; productId: Hex }[];
    wallet: Address;
}): Promise<
    Record<Address, { canEdit: boolean; isActive: boolean; isRunning: boolean }>
> {
    // If no address provided, early exit
    if (campaignProductIds.length === 0) {
        return {};
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
                        functionName: "hasAllRolesOrAdmin",
                        args: [
                            BigInt(productId),
                            wallet,
                            roles.campaignManager,
                        ],
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
            acc[address] = {
                canEdit: canEdits[index],
                isActive: isActives[index],
                isRunning: isRunnings[index],
            };
            return acc;
        },
        {} as Record<
            Address,
            { canEdit: boolean; isActive: boolean; isRunning: boolean }
        >
    );
}
