"use server";

import { getSafeSession } from "@/context/auth/actions/session";
import { interactionCampaignAbi } from "@/context/blockchain/abis/frak-campaign-abis";
import { getCampaignRepository } from "@/context/campaigns/repository/CampaignRepository";
import { getClient } from "@/context/indexer/client";
import type { Campaign } from "@/types/Campaign";
import { frakChainPocClient } from "@frak-labs/nexus-wallet/src/context/blockchain/provider";
import { gql } from "@urql/core";
import { type Address, isAddressEqual } from "viem";
import { multicall } from "viem/actions";

/**
 * Get the content for a given administrator query
 */
const QUERY = gql(`
query GetCampaignForContents($wallet: String!) {
  contentAdministrators(
    limit: 10
    where: {user: $wallet}
  ) {
    items {
      isOwner
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
                        detachTimestamp: string;
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
export async function getMyCampaigns(): Promise<Campaign[]> {
    const session = await getSafeSession();

    // Get our indexer result
    const result = await getClient()
        .query<QueryResult>(QUERY, { wallet: session.wallet })
        .toPromise();

    // Extract each campaigns and find them in the mongo database
    const blockchainCampaigns =
        result.data?.contentAdministrators.items.flatMap(
            (item) => item.content.campaigns.items
        );
    if (!blockchainCampaigns) return [];

    // Find the campaigns in the database
    const repository = await getCampaignRepository();
    const campaignDocuments = await repository.findByAddressesOrCreator({
        addresses: blockchainCampaigns.map((campaign) => campaign.id),
        creator: session.wallet,
    });

    // Find each state for each campaigns
    const isActiveArr = await multicall(frakChainPocClient, {
        contracts: blockchainCampaigns.map(
            (campaign) =>
                ({
                    abi: interactionCampaignAbi,
                    address: campaign.id as Address,
                    functionName: "isActive",
                    args: [],
                }) as const
        ),
        allowFailure: false,
    });

    // Map all of that to campaign with state object
    return campaignDocuments.map((campaign) => {
        // todo: How to get the campaign address????
        const state = campaign.state;
        if (state.key !== "created") {
            return campaign;
        }

        // Find the blockchain campaign index
        const blockchainCampaignIndex = blockchainCampaigns.findIndex((item) =>
            isAddressEqual(item.id, state.address)
        );

        // Find the activation status
        const isActive = isActiveArr[blockchainCampaignIndex];

        return {
            ...campaign,
            state: {
                ...state,
                isActive,
            },
        };
    });
}
