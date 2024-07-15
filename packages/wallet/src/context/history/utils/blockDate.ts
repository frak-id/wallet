"use server";

import { getViemClientFromChainId } from "@/context/blockchain/provider";
import { unstable_cache } from "next/cache";
import { getBlock } from "viem/actions";

/**
 * Get the timestamp of the given block
 * @param blockHash
 */
async function _getBlockDate({
    blockNumber,
    chainId,
}: { blockNumber: bigint; chainId: number }) {
    const viemClient = getViemClientFromChainId({ chainId });
    const block = await getBlock(viemClient, {
        blockNumber,
        includeTransactions: false,
    });
    return new Date(Number(block.timestamp) * 1000);
}

export const getBlockDate = unstable_cache(_getBlockDate, ["get-block-date"], {
    // Keep that in server cache for 30 days
    revalidate: 720 * 60 * 60,
});
