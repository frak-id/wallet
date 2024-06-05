"use server";

import { addresses } from "@/context/blockchain/addresses";
import { frakChainPocClient } from "@/context/blockchain/provider";
import { nexusDiscoverCampaignAbi } from "@/context/referral/abi/campaign-abis";
import { isReferralPossible } from "@/context/referral/utils/isReferralPossible";
import { tryit } from "radash";
import { type Address, type Hex, encodeFunctionData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { prepareTransactionRequest, sendTransaction } from "viem/actions";
import { arbitrumSepolia } from "viem/chains";

/**
 * Tree for the nexus referral campaign
 */
const NEXUS_REFERRAL_TREE: Hex =
    "0x3775089540b3adee32fd34ba601a5eca0a0ba73151fb33bafb852eee7a47d4ee";

/**
 * Tell that a user has been referred by another user
 * @param user
 * @param referrer
 */
export async function setUserReferred({
    user,
    referrer,
}: { user: Address; referrer: Address }) {
    const isPossible = await isReferralPossible({
        user,
        referrer,
        tree: NEXUS_REFERRAL_TREE,
    });
    if (!isPossible) {
        return undefined;
    }

    // Get the airdropper private key
    const airdropperPrivateKey = process.env.AIRDROP_PRIVATE_KEY;
    if (!airdropperPrivateKey) {
        throw new Error("Missing AIRDROP_PRIVATE_KEY env variable");
    }

    // Build our airdrop account
    const airdropperAccount = privateKeyToAccount(airdropperPrivateKey as Hex);

    // Prepare the transaction
    const [, preparationResult] = await tryit(() =>
        prepareTransactionRequest(frakChainPocClient, {
            account: airdropperAccount,
            chain: arbitrumSepolia,
            to: addresses.nexusDiscoverCampaign,
            data: encodeFunctionData({
                abi: nexusDiscoverCampaignAbi,
                functionName: "distributeInstallationReward",
                args: [user, referrer],
            }),
        })
    )();
    if (!preparationResult) {
        return undefined;
    }

    // Send the tx
    const txHash = await sendTransaction(frakChainPocClient, preparationResult);
    console.log("User referred by another user", { user, referrer, txHash });
    return txHash;
}
