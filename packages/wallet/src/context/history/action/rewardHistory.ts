"use server";
import type { RewardHistory } from "@/types/RewardHistory";
import ky from "ky";
import { unstable_cache } from "next/cache";
import { type Address, type Hex, formatEther } from "viem";

type ApiResult = {
    added: {
        amount: string;
        timestamp: string;
        txHash: Hex;
    }[];
    claimed: {
        amount: string;
        timestamp: string;
        txHash: Hex;
    }[];
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
    // Perform the request to our api
    const rewardsHistory = await ky
        .get(`https://indexer.frak.id/rewards/${account}/history`)
        .json<ApiResult>();

    // Merge both array into one
    const finalArray = [
        ...(rewardsHistory?.added?.map(
            (item) =>
                ({
                    type: "add",
                    amount: Number.parseFloat(formatEther(BigInt(item.amount))),
                    timestamp: Number.parseInt(item.timestamp),
                    txHash: item.txHash,
                }) as const
        ) ?? []),
        ...(rewardsHistory?.claimed?.map(
            (item) =>
                ({
                    type: "claim",
                    amount: Number.parseFloat(formatEther(BigInt(item.amount))),
                    timestamp: Number.parseInt(item.timestamp),
                    txHash: item.txHash,
                }) as const
        ) ?? []),
    ];

    // Sort it by timestamp
    finalArray.sort((a, b) => a.timestamp - b.timestamp);
    return finalArray;
}

/**
 * Cached version of the wallet history fetch
 */
export const getRewardHistory = unstable_cache(
    _getRewardHistory,
    ["history", "reward"],
    {
        // Keep that in server cache for 2min
        revalidate: 2 * 60,
    }
);
