"use server";

import { paywallAddress } from "@/context/common/blockchain/addresses";
import { paywallAbi } from "@/context/common/blockchain/frak-abi";
import { viemClient } from "@/context/common/blockchain/provider";
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
    const [isAllowed, allowedUntilInSec] = await readContract(viemClient, {
        address: paywallAddress,
        abi: paywallAbi,
        functionName: "isReadAllowed",
        args: [BigInt(contentId), articleId, user],
        // Get the value on the pending block, to be fast as fast as possible
        blockTag: "pending",
    });

    // Return the status
    return {
        isAllowed: isAllowed,
        allowedUntilInSec: Number(allowedUntilInSec),
        allowedUntilDate: new Date(Number(allowedUntilInSec) * 1000),
    };
}
