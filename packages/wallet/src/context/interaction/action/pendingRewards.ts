"use server";
import { getClient } from "@frak-labs/nexus-dashboard/src/context/indexer/client";
import { referralCampaignAbi } from "@frak-labs/shared/context/blockchain/abis/frak-campaign-abis";
import { gql } from "@urql/core";
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
export async function getPendingRewards({ user }: { user: Address }) {
    // Get our indexer result
    const result = await getClient()
        .query<QueryResult>(QUERY, { wallet: user })
        .toPromise();

    if (!result.data) {
        throw new Error("No data found");
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
