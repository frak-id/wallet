"use server";

import { getSafeSession } from "@/context/auth/actions/session";
import { campaignRoles } from "@/context/blockchain/roles";
import { getCampaignRepository } from "@/context/campaigns/repository/CampaignRepository";
import { getClient } from "@/context/indexer/client";
import type { CampaignWithState } from "@/types/Campaign";
import { frakChainPocClient } from "@frak-labs/nexus-wallet/src/context/blockchain/provider";
import { interactionCampaignAbi } from "@frak-labs/shared/context/blockchain/abis/frak-campaign-abis";
import { gql } from "@urql/core";
import { all } from "radash";
import { type Address, isAddressEqual } from "viem";
import { multicall } from "viem/actions";

/**
 * Get the content for a given administrator query
 */
const QUERY = gql(`
query GetCampaignForUser($wallet: String!) {
  contentAdministrators(
    where: {user: $wallet}
  ) {
    items {
      content {
        id
        campaigns {
          items {
            id
            attached
            detachTimestamp
            attachTimestamp
            name
            version
          }
        }
      }
    }
  }
 }
`);

type QueryResult = {
    contentAdministrators: {
        items: {
            content: {
                id: string;
                campaigns: {
                    items: {
                        id: Address;
                        attached: boolean;
                        detachTimestamp: string | null;
                        attachTimestamp: string;
                        name: string;
                        version: string;
                    }[];
                };
            };
        }[];
    };
};

/**
 * Get the current user campaigns
 */
export async function getMyCampaigns(): Promise<CampaignWithState[]> {
    const session = await getSafeSession();

    // Get our indexer result
    const result = await getClient()
        .query<QueryResult>(QUERY, { wallet: session.wallet })
        .toPromise();

    // Extract each campaigns and find them in the mongo database
    let blockchainCampaigns = result.data?.contentAdministrators.items.flatMap(
        (item) => item.content.campaigns.items
    );
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
            isActivesNew: multicall(frakChainPocClient, {
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
            canEditsNew: multicall(frakChainPocClient, {
                contracts: blockchainCampaigns.map(
                    (campaign) =>
                        ({
                            abi: interactionCampaignAbi,
                            address: campaign.id,
                            functionName: "hasAnyRole",
                            args: [session.wallet, campaignRoles.manager],
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
                    isAttached: blockchainCampaign.attached,
                    attachTimestamp: blockchainCampaign.attachTimestamp,
                    detachTimestamp:
                        blockchainCampaign.detachTimestamp ?? undefined,
                },
                isAttached: blockchainCampaign.attached,
                isActive: isActives[blockchainCampaignIndex],
            },
        };
    });
}
