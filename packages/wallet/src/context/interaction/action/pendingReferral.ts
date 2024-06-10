"use server";

import { referralCampaignAbi } from "@/context/blockchain/abis/frak-campaign-abis";
import { addresses } from "@/context/blockchain/addresses";
import { contentIds } from "@/context/blockchain/contentIds";
import { frakChainPocClient } from "@/context/blockchain/provider";
import { getCampaignContracts } from "@/context/interaction/action/interactionContracts";
import { sift } from "radash";
import { type Address, encodeFunctionData, formatEther } from "viem";
import { multicall } from "viem/actions";

/**
 * Tell that a user has been referred by another user
 * @param user
 * @param referrer
 */
export async function getPendingReferralReward({ user }: { user: Address }) {
    const campaignContracts = await getCampaignContracts({
        contentId: [
            contentIds["le-monde"],
            contentIds.equipe,
            contentIds.wired,
            contentIds.frak,
        ],
    });

    // Get the pending reward on each contract
    const pendingAmountPerContract = await multicall(frakChainPocClient, {
        contracts: campaignContracts.map(
            (address) =>
                ({
                    address,
                    abi: referralCampaignAbi,
                    functionName: "getPendingAmount",
                    args: [user],
                }) as const
        ),
    });

    // Extract the total pending
    const pendingAmount = pendingAmountPerContract.reduce((acc, result) => {
        if (result.status === "success") {
            return acc + result.result;
        }
        return acc;
    }, 0n);
    if (pendingAmount === 0n) {
        return null;
    }

    // Extract the pending amount per contract
    const perContracts = pendingAmountPerContract.map((result, index) => {
        if (result.status === "success" && result.result > 0n) {
            return {
                address: campaignContracts[index],
                amount: result.result,
                claimTx: encodeFunctionData({
                    abi: referralCampaignAbi,
                    functionName: "pullReward",
                    args: [addresses.paywallToken],
                }),
            };
        }
        return null;
    });

    return {
        pFrkPendingRaw: pendingAmount,
        pFrkPendingFormatted: formatEther(pendingAmount),
        perContracts: sift(perContracts),
    };
}
