"use server";

import type { RewardHistory } from "@/types/RewardHistory";
import { getClient } from "@frak-labs/nexus-dashboard/src/context/indexer/client";
import { gql } from "@urql/core";
import { unstable_cache } from "next/cache";
import { type Address, type Hex, formatEther } from "viem";

const QUERY = gql(`
query RewardHistoryQuery($wallet: String!) {
  rewardAddedEvents(limit: 20, where: {rewardId_contains: $wallet}) {
    items {
      amount
      timestamp
      txHash
    }
  }
  rewardClaimedEvents(limit: 20, where: {rewardId_contains: $wallet}) {
    items {
      amount
      timestamp
      txHash
    }
  }
}
`);

type QueryResult = {
    rewardClaimedEvents: {
        items: {
            amount: string;
            timestamp: string;
            txHash: Hex;
        }[];
    };
    rewardAddedEvents: {
        items: {
            amount: string;
            timestamp: string;
            txHash: Hex;
        }[];
    };
};

/**
 * Get the reward history for a user
 * @param account
 */
async function _getRewardHistory({
    account,
}: {
    account: Address;
}): Promise<RewardHistory[]> {
    // Get our indexer result
    const result = await getClient()
        .query<QueryResult>(QUERY, { wallet: account })
        .toPromise();

    // Map our result
    return [
        ...(result.data?.rewardAddedEvents?.items?.map(
            (item) =>
                ({
                    type: "add",
                    amount: Number.parseFloat(formatEther(BigInt(item.amount))),
                    timestamp: Number.parseInt(item.timestamp),
                    txHash: item.txHash,
                }) as const
        ) ?? []),
        ...(result.data?.rewardClaimedEvents?.items?.map(
            (item) =>
                ({
                    type: "claim",
                    amount: Number.parseFloat(formatEther(BigInt(item.amount))),
                    timestamp: Number.parseInt(item.timestamp),
                    txHash: item.txHash,
                }) as const
        ) ?? []),
    ];
}

/**
 * Cached version of the wallet history fetch
 */
export const getRewardHistory = unstable_cache(
    _getRewardHistory,
    ["history", "reward"],
    {
        // Keep that in server cache for 10min
        revalidate: 10 * 60,
    }
);
