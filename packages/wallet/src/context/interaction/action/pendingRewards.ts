"use server";
import type { Token } from "@/types/Token";
import { campaignBankAbi } from "@frak-labs/app-essentials/blockchain";
import { indexerApi } from "@frak-labs/shared/context/server";
import { type Address, encodeFunctionData, formatEther } from "viem";

type ApiResult = {
    rewards: {
        amount: string;
        address: Address;
    }[];
    tokens: Token[];
};

/**
 * Tell that a user has been referred by another user
 * @param user
 * @param referrer
 */
export async function getPendingRewards({ user }: { user: Address }) {
    // Perform the request to our api
    const { rewards } = await indexerApi
        .get(`rewards/${user}`)
        .json<ApiResult>();

    if (!rewards.length) {
        return null;
    }

    const claimTx = encodeFunctionData({
        abi: campaignBankAbi,
        functionName: "pullReward",
        args: [user],
    });

    // Extract the pending rewards
    const pendingRewards = rewards.map((reward) => {
        return {
            address: reward.address,
            amount: BigInt(reward.amount),
            claimTx,
        };
    });

    // Pending amount is the total pending amount
    const pendingAmount = pendingRewards.reduce((acc, result) => {
        return acc + result.amount;
    }, 0n);

    return {
        pendingRaw: pendingAmount,
        pendingFormatted: formatEther(pendingAmount),
        perContracts: pendingRewards,
    };
}
