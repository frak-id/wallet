"use server";

import { frakChainPocClient } from "@/context/blockchain/provider";
import { communityTokenAbi } from "@frak-labs/shared/context/blockchain/abis/frak-gating-abis";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
import { unstable_cache } from "next/cache";
import { readContract } from "viem/actions";

/**
 * Check if the community token is enabled for the given content
 * @param contentId
 */
async function _isCommunityTokenForContentEnabled({
    contentId,
}: { contentId: bigint }) {
    return await readContract(frakChainPocClient, {
        address: addresses.communityToken,
        abi: communityTokenAbi,
        functionName: "isEnabled",
        args: [contentId],
    });
}

export const isCommunityTokenForContentEnabled = unstable_cache(
    _isCommunityTokenForContentEnabled,
    ["check-community-token-for-content"],
    {
        // Keep that in server cache for 48hr
        revalidate: 60 * 60 * 48,
    }
);
