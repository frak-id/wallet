"use server";

import { addresses } from "@/context/common/blockchain/addresses";
import { frakChainPocClient } from "@/context/common/blockchain/provider";
import { nexusDiscoverCampaignAbi } from "@/context/referral/abi/campaign-abis";
import { type Address, formatEther } from "viem";
import { readContract } from "viem/actions";

/**
 * Tell that a user has been referred by another user
 * @param user
 * @param referrer
 */
export async function getPendingWalletReferralReward({
    user,
}: { user: Address }) {
    const pendingAmount = await readContract(frakChainPocClient, {
        address: addresses.nexusDiscoverCampaign,
        abi: nexusDiscoverCampaignAbi,
        functionName: "getPendingAmount",
        args: [user],
    });
    if (!pendingAmount) {
        return null;
    }
    return {
        rFrkPendingRaw: pendingAmount,
        rFrkPendingFormatted: formatEther(pendingAmount),
    };
}
