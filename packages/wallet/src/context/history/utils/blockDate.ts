"use server";

import { currentViemClient } from "@/context/blockchain/provider";
import { unstable_cache } from "next/cache";
import { getBlock } from "viem/actions";

/**
 * Get the timestamp of the given block
 * @param blockHash
 */
async function _getBlockDate({ blockNumber }: { blockNumber: bigint }) {
    const block = await getBlock(currentViemClient, {
        blockNumber,
        includeTransactions: false,
    });
    return new Date(Number(block.timestamp) * 1000);
}

export const getBlockDate = unstable_cache(_getBlockDate, ["get-block-date"], {
    // Keep that in server cache for 30 days
    revalidate: 720 * 60 * 60,
});
