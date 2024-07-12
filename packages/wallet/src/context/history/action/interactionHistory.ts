"use server";

import type { InteractionHistory } from "@/types/InteractionHistory";
import { getClient } from "@frak-labs/nexus-dashboard/src/context/indexer/client";
import { gql } from "@urql/core";
import { unstable_cache } from "next/cache";
import type { Address } from "viem";

const QUERY = gql(`
query InteractionHistoryQuery($wallet: String!) {
  pressEvents(limit: 50, where: {user: $wallet}) {
    items {
      data
      type
      timestamp
      interaction {
        contentId
      }
    }
  }
}
`);

type QueryResult = {
    pressEvents: {
        items: QueryItemType[];
    };
};

type QueryItemType = {
    timestamp: string;
    interaction: {
        contentId: string;
    };
} & (
    | {
          type: "OPEN_ARTICLE" | "READ_ARTICLE";
          data: {
              articleId: string;
          };
      }
    | {
          type: "REFERRED";
          data: {
              referrer: Address;
          };
      }
);

/**
 * Get the reward history for a user
 * @param account
 */
async function _getInteractionHistory({
    account,
}: {
    account: Address;
}): Promise<InteractionHistory[]> {
    // Get our indexer result
    const result = await getClient()
        .query<QueryResult>(QUERY, { wallet: account })
        .toPromise();

    // Map our result
    return (
        result.data?.pressEvents?.items?.map((item) => {
            const { timestamp, interaction } = item;

            let mapped: InteractionHistory;

            if (item.type === "OPEN_ARTICLE" || item.type === "READ_ARTICLE") {
                mapped = {
                    contentId: interaction.contentId,
                    timestamp: Number(timestamp),
                    type: item.type,
                    data: {
                        articleId: item.data.articleId,
                    },
                };
            } else if (item.type === "REFERRED") {
                mapped = {
                    contentId: interaction.contentId,
                    timestamp: Number(timestamp),
                    type: "REFERRED",
                    data: {
                        referrer: item.data.referrer,
                    },
                };
            } else {
                throw new Error(`Unknown interaction type: ${item.type}`);
            }
            return mapped;
        }) ?? []
    );
}

/**
 * Cached version of the wallet history fetch
 */
export const getInteractionHistory = unstable_cache(
    _getInteractionHistory,
    ["history", "interaction"],
    {
        // Keep that in server cache for 10min
        revalidate: 10 * 60,
    }
);
