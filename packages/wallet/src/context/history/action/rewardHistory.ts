"use server";
import type { RewardHistory } from "@/types/RewardHistory";
import type { Token } from "@/types/Token";
import { indexerApi } from "@frak-labs/shared/context/server";
import { type Address, type Hex, formatUnits, isAddressEqual } from "viem";

type ApiResult = {
    added: {
        amount: string;
        timestamp: string;
        txHash: Hex;
        token: Address;
    }[];
    claimed: {
        amount: string;
        timestamp: string;
        txHash: Hex;
        token: Address;
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
        ...(rewardsHistory?.added?.map((item) => {
            const token = rewardsHistory.tokens.find((token) =>
                isAddressEqual(token.address, item.token)
            );
            return {
                type: "add",
                amount: Number.parseFloat(
                    formatUnits(BigInt(item.amount), token?.decimal ?? 18)
                ),
                timestamp: Number.parseInt(item.timestamp),
                txHash: item.txHash,
            } as const;
        }) ?? []),
        ...(rewardsHistory?.claimed?.map((item) => {
            const token = rewardsHistory.tokens.find((token) =>
                isAddressEqual(token.address, item.token)
            );
            return {
                type: "claim",
                amount: Number.parseFloat(
                    formatUnits(BigInt(item.amount), token?.decimal ?? 18)
                ),
                timestamp: Number.parseInt(item.timestamp),
                txHash: item.txHash,
            } as const;
        }) ?? []),
    ];

    // Sort it by timestamp in the descending order
    return finalArray.sort((a, b) => b.timestamp - a.timestamp);
}
