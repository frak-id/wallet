"use server";

import { addresses } from "@/context/common/blockchain/addresses";
import { frakChainPocClient } from "@/context/common/blockchain/provider";
import { nexusDiscoverCampaignAbi } from "@/context/referral/abi/campaign-abis";
import { isReferralPossible } from "@/context/referral/utils/isReferralPossible";
import { tryit } from "radash";
import {
    type Address,
    type Hex,
    encodeFunctionData,
    encodePacked,
    keccak256,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { prepareTransactionRequest, sendTransaction } from "viem/actions";
import { arbitrumSepolia } from "viem/chains";

/**
 * Get the referral tree for the given content
 * @param contentId
 */
function getContentReferralTree(contentId: Hex): Hex {
    return keccak256(
        encodePacked(
            ["string", "uint256"],
            ["ContentDiscoveryTree", BigInt(contentId)]
        )
    );
}

/**
 * Tell that a user has been referred by another user on a given content
 * @param user
 * @param referrer
 * @param contentId
 */
export async function setUserReferredOnContent({
    user,
    referrer,
    contentId,
}: { user: Address; referrer: Address; contentId: Hex }) {
    const isPossible = await isReferralPossible({
        user,
        referrer,
        tree: getContentReferralTree(contentId),
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
                functionName: "distributeContentDiscoveryReward",
                args: [user, referrer, BigInt(contentId)],
            }),
        })
    )();
    if (!preparationResult) {
        return undefined;
    }

    // Send the tx
    const txHash = await sendTransaction(frakChainPocClient, preparationResult);
    console.log("User referred by another user on the given content", {
        user,
        referrer,
        contentId,
        txHash,
    });
    return txHash;
}
