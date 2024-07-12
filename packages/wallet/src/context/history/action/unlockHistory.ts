"use server";

import { paidItemUnlockedEventAbi } from "@/context/blockchain/abis/event-abi";
import { getViemClientFromChainId } from "@/context/blockchain/provider";
import { formatSecondDuration } from "@/context/common/duration";
import { getBlockDate } from "@/context/history/utils/blockDate";
import type { ArticleUnlockHistory } from "@/types/ArticleUnlockHistory";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
import { unstable_cache } from "next/cache";
import { parallel, sort } from "radash";
import { type Address, formatEther, toHex } from "viem";
import { getLogs } from "viem/actions";

async function _getUnlockHistory({
    account,
    chainId,
}: {
    account: Address;
    chainId: number;
}) {
    // Get the client for the given chain
    const viemClient = getViemClientFromChainId({ chainId });

    // Get the paid item unlocked events for a user
    const unlockedItemsEvents = await getLogs(viemClient, {
        address: addresses.paywall,
        event: paidItemUnlockedEventAbi,
        args: { user: account },
        strict: true,
        fromBlock: "earliest",
        toBlock: "latest",
    });

    // Map them to the ArticleUnlock type
    const unlockedItems: ArticleUnlockHistory[] = await parallel(
        2,
        unlockedItemsEvents,
        async (log) => {
            const { contentId, articleId, paidAmount, allowedUntil } = log.args;

            // Parse the allowed until date
            const allowedUntilDate = new Date(Number(allowedUntil) * 1000);

            // Compute the remaining duration if still allowed
            const remainingTimeInSec =
                Number(allowedUntil) - Math.floor(Date.now() / 1000);

            // Check if the date is past or no
            const isAllowed = remainingTimeInSec > 0;

            // Return the item
            return {
                key: "article-unlock",
                txHash: log.transactionHash,
                blockNumber: log.blockNumber,
                txDate: await getBlockDate({
                    blockNumber: log.blockNumber,
                    chainId,
                }),
                contentId: toHex(contentId),
                articleId,
                paidAmount: formatEther(paidAmount),
                allowedUntil: allowedUntilDate,
                isStillAllowed: isAllowed,
                remainingTimeInSec: isAllowed ? remainingTimeInSec : undefined,
                remainingTimeFormatted: isAllowed
                    ? formatSecondDuration(remainingTimeInSec)
                    : undefined,
            };
        }
    );

    // Put all of that in one list and sort it
    return sort(unlockedItems, (item) => Number(item.blockNumber), true);
}

/**
 * Cached version of the wallet history fetch
 */
export const getUnlockHistory = unstable_cache(
    _getUnlockHistory,
    ["history", "unlock"],
    {
        // Keep that in server cache for 10min
        revalidate: 10 * 60,
    }
);
