import type { RewardHistory } from "@/types/RewardHistory";
import type { Token } from "@/types/Token";
import { indexerApi } from "@frak-labs/shared/context/server";
import { type Address, type Hex, formatEther } from "viem";

type ApiResult = {
    added: {
        amount: string;
        timestamp: string;
        txHash: Hex;
        productId: string;
        productName: string;
    }[];
    claimed: {
        amount: string;
        timestamp: string;
        txHash: Hex;
        productId: string;
        productName: string;
    }[];
    tokens: Token[];
};

/**
 * Get the reward history for a user
 * @param account
 */
export async function getRewardHistory({
    account,
}: {
    account: Address;
}): Promise<RewardHistory[]> {
    // Perform the request to our api
    const rewardsHistory = await indexerApi
        .get(`rewards/${account}/history`)
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
                    productId: item.productId,
                    productName: item.productName,
                }) as const
        ) ?? []),
        ...(rewardsHistory?.claimed?.map(
            (item) =>
                ({
                    type: "claim",
                    amount: Number.parseFloat(formatEther(BigInt(item.amount))),
                    timestamp: Number.parseInt(item.timestamp),
                    txHash: item.txHash,
                    productId: item.productId,
                    productName: item.productName,
                }) as const
        ) ?? []),
    ];

    // Sort it by timestamp in the descending order
    return finalArray.sort((a, b) => b.timestamp - a.timestamp);
}
