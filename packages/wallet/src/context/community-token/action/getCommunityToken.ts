"use server";

import { addresses } from "@/context/common/blockchain/addresses";
import { communityTokenAbi } from "@/context/common/blockchain/poc-abi";
import { arbSepoliaPocClient } from "@/context/common/blockchain/provider";
import { unstable_cache } from "next/cache";
import { readContract } from "viem/actions";

/**
 * Check if the community token is enabled for the given content
 * @param contentId
 */
async function _isCommunityTokenForContentEnabled({
    contentId,
}: { contentId: number }) {
    return await readContract(arbSepoliaPocClient, {
        address: addresses.communityToken,
        abi: communityTokenAbi,
        functionName: "isEnabled",
        args: [BigInt(contentId)],
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
