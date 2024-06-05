"use server";

import { paywallAbi } from "@/context/blockchain/abis/frak-gating-abis";
import { addresses } from "@/context/blockchain/addresses";
import { frakChainPocClient } from "@/context/blockchain/provider";
import type { Address, Hex } from "viem";
import { readContract } from "viem/actions";

/**
 * Get the current unlock status of a user on the given article
 * @param contentId
 * @param articleId
 * @param user
 */
export async function getUnlockStatusOnArticle({
    contentId,
    articleId,
    user,
}: {
    contentId: Hex;
    articleId: Hex;
    user: Address;
}) {
    // Get the status
    const [isAllowed, allowedUntilInSec] = await readContract(
        frakChainPocClient,
        {
            address: addresses.paywall,
            abi: paywallAbi,
            functionName: "isReadAllowed",
            args: [BigInt(contentId), articleId, user],
            // Get the value on the pending block, to be fast as fast as possible
            blockTag: "pending",
        }
    );

    // Return the status
    return {
        isAllowed: isAllowed,
        allowedUntilInSec: Number(allowedUntilInSec),
        allowedUntilDate: new Date(Number(allowedUntilInSec) * 1000),
    };
}
