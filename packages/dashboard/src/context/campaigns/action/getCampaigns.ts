"use server";

import { getSafeSession } from "@/context/auth/actions/session";
import { campaignRoles } from "@/context/blockchain/roles";
import { getCampaignRepository } from "@/context/campaigns/repository/CampaignRepository";
import { getClient } from "@/context/indexer/client";
import type { CampaignWithState } from "@/types/Campaign";
import { frakChainPocClient } from "@frak-labs/nexus-wallet/src/context/blockchain/provider";
import { interactionCampaignAbi } from "@frak-labs/shared/context/blockchain/abis/frak-campaign-abis";
import { gql } from "@urql/core";
import { all, omit } from "radash";
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
        const campaignNoId = omit(campaign, ["_id"]);
        const state = campaign.state;
        if (state.key !== "created") {
            return campaignNoId as CampaignWithState;
        }

        // Find the blockchain campaign index
        const blockchainCampaignIndex = blockchainCampaigns.findIndex((item) =>
            isAddressEqual(item.id, state.address)
        );
        if (blockchainCampaignIndex === -1) {
            console.error("No blockchain campaign found for", state.address);
            return campaignNoId as CampaignWithState;
        }
        const blockchainCampaign = blockchainCampaigns[blockchainCampaignIndex];

        return {
            ...campaignNoId,
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
                canEdit: canEdits[blockchainCampaignIndex],
            },
        };
    });
}
