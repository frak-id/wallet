"use server";

import { getSafeSession } from "@/context/auth/actions/session";
import { getCampaignRepository } from "@/context/campaigns/repository/CampaignRepository";
import { getClient } from "@/context/indexer/client";
import type { Campaign } from "@/types/Campaign";
import { gql } from "@urql/core";
import type { Address } from "viem";

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
                        id: string;
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

    const repository = await getCampaignRepository();
    // todo: also add the attachmend state on the blockchain side?
    // todo: Maybe link with another query returning some more infos about the campaign?
    return await repository.findByAddresses(
        blockchainCampaigns.map((campaign) => campaign.id as Address)
    );
}
