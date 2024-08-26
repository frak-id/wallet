"use server";
import { referralCampaignAbi } from "@frak-labs/shared/context/blockchain/abis/frak-campaign-abis";
import ky from "ky";
import { unstable_cache } from "next/cache";
import { type Address, encodeFunctionData, formatEther } from "viem";

type ApiResult = Array<{
    amount: string;
    address: Address;
}>;

/**
 * Tell that a user has been referred by another user
 * @param user
 * @param referrer
 */
async function _getPendingRewards({ user }: { user: Address }) {
    // Perform the request to our api
    const rewards = await ky
        .get(`https://indexer.frak.id/rewards/${user}`)
        .json<ApiResult>();

    if (!rewards.length) {
        return null;
    }

    const claimTx = encodeFunctionData({
        abi: referralCampaignAbi,
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
