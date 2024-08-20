"use server";

import { getSafeSession } from "@/context/auth/actions/session";
import { campaignRoles } from "@/context/blockchain/roles";
import { getCampaignRepository } from "@/context/campaigns/repository/CampaignRepository";
import type { CampaignWithState } from "@/types/Campaign";
import { currentViemClient } from "@frak-labs/nexus-wallet/src/context/blockchain/provider";
import { interactionCampaignAbi } from "@frak-labs/shared/context/blockchain/abis/frak-campaign-abis";
import ky from "ky";
import { all } from "radash";
import { type Address, isAddressEqual } from "viem";
import { multicall } from "viem/actions";

type ApiResult = {
    contentId: string;
    isContentOwner: number; // bool
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

    // Perform the request to our api
    let blockchainCampaigns = await ky
        .get(`https://indexer.frak.id/admin/${session.wallet}/campaigns`)
        .json<ApiResult>();

    if (!blockchainCampaigns) {
        blockchainCampaigns = [];
    }

    // Find the campaigns in the database
    const repository = await getCampaignRepository();
    const campaignDocuments = await repository.findByAddressesOrCreator({
        addresses: blockchainCampaigns.map((campaign) => campaign.id),
        creator: session.wallet,
    });

    // Find each state for each campaigns
    let isActives: boolean[] = [];
    let canEdits: boolean[] = [];
    if (blockchainCampaigns.length > 0) {
        const { isActivesNew, canEditsNew } = await all({
            // Check if the campaign is active
            isActivesNew: multicall(currentViemClient, {
                contracts: blockchainCampaigns.map(
                    (campaign) =>
                        ({
                            abi: interactionCampaignAbi,
                            address: campaign.id,
                            functionName: "isActive",
                            args: [],
                        }) as const
                ),
                allowFailure: false,
            }),
            // Check if the campaign can be edited
            canEditsNew: multicall(currentViemClient, {
                contracts: blockchainCampaigns.map(
                    (campaign) =>
                        ({
                            abi: interactionCampaignAbi,
                            address: campaign.id,
                            functionName: "hasAnyRole",
                            args: [
                                session.wallet,
                                BigInt(campaignRoles.manager),
                            ],
                        }) as const
                ),
                allowFailure: false,
            }),
        });
        isActives = isActivesNew;
        canEdits = canEditsNew;
    }

    // Map all of that to campaign with state object
    return campaignDocuments.map((campaign) => {
        // Build the initial full campaign
        const mappedCampaign = {
            ...campaign,
            _id: campaign._id.toHexString(),
            actions: {
                canEdit: isAddressEqual(campaign.creator, session.wallet),
                canDelete: isAddressEqual(campaign.creator, session.wallet),
            },
        };

        const state = campaign.state;
        if (state.key !== "created") {
            // Update the mapped campaign to disallow edit if in state creationFailed
            mappedCampaign.actions.canEdit = state.key !== "creationFailed";
            // And return it
            return mappedCampaign as CampaignWithState;
        }

        // Find the blockchain campaign index
        const blockchainCampaignIndex = blockchainCampaigns.findIndex((item) =>
            isAddressEqual(item.id, state.address)
        );
        const blockchainCampaign =
            blockchainCampaignIndex === -1
                ? undefined
                : blockchainCampaigns[blockchainCampaignIndex];
        if (!blockchainCampaign) {
            // Tell that the user can't edit it and return
            return mappedCampaign as CampaignWithState;
        }

        // Update the edit state depending on it
        mappedCampaign.actions.canEdit = canEdits[blockchainCampaignIndex];

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
                isActive: isActives[blockchainCampaignIndex],
            },
        };
    });
}
