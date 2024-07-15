"use server";
import { getClient } from "@frak-labs/nexus-dashboard/src/context/indexer/client";
import { referralCampaignAbi } from "@frak-labs/shared/context/blockchain/abis/frak-campaign-abis";
import { gql } from "@urql/core";
import { unstable_cache } from "next/cache";
import { type Address, encodeFunctionData, formatEther } from "viem";

const QUERY = gql(`
query RewardsQuery($wallet: String!) {
  rewards(where: {pendingAmount_not: "0", user: $wallet}) {
    items {
      pendingAmount
      contract {
        id
      }
    }
  }
}
`);
type QueryResult = {
    rewards: {
        items: {
            pendingAmount: string;
            contract: {
                id: Address;
            };
        }[];
    };
};

/**
 * Tell that a user has been referred by another user
 * @param user
 * @param referrer
 */
async function _getPendingRewards({ user }: { user: Address }) {
    // Get our indexer result
    const result = await getClient()
        .query<QueryResult>(QUERY, { wallet: user })
        .toPromise();

    if (!result.data?.rewards.items.length) {
        return null;
    }

    // Extract the pending rewards
    const pendingRewards = result.data.rewards.items.map((item) => {
        return {
            address: item.contract.id,
            amount: BigInt(item.pendingAmount),
            claimTx: encodeFunctionData({
                abi: referralCampaignAbi,
                functionName: "pullReward",
                args: [user],
            }),
        };
    });

    // Pending amount is the total pending amount
    const pendingAmount = pendingRewards.reduce((acc, result) => {
        return acc + result.amount;
    }, 0n);

    return {
        pFrkPendingRaw: pendingAmount,
        pFrkPendingFormatted: formatEther(pendingAmount),
        perContracts: pendingRewards,
    };
}

/**
 * Cached version of the user tokens
 */
export const getPendingRewards = unstable_cache(
    _getPendingRewards,
    ["get-pending-rewards"],
    {
        // Keep that in server cache for 15min
        revalidate: 15 * 60,
    }
);
