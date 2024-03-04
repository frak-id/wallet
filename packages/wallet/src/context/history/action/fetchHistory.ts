"use server";

import {
    addresses,
    paywallAddress,
} from "@/context/common/blockchain/addresses";
import {
    frkTransferEvent,
    paidItemUnlockedEventAbi,
} from "@/context/common/blockchain/event-abi";
import { viemClient } from "@/context/common/blockchain/provider";
import { formatSecondDuration } from "@/context/common/duration";
import type {
    ArticleUnlock,
    FrkReceived,
    FrkSent,
    HistoryItem,
} from "@/types/HistoryItem";
import { unstable_cache } from "next/cache";
import { map, sort } from "radash";
import { type Address, type Hash, formatEther, toHex } from "viem";
import { getBlock, getLogs } from "viem/actions";

/**
 * The initial block from where we fetch the logs
 *  - This match the block during time of developments
 */
const initialBlock = 45609416n;

/**
 * Get am account full history
 *   - In a non POC world, this shouldn't use getLogs, but instead use an indexed database like thegraph or pounder.sh
 * @param account
 */
async function _fetchWalletHistory({
    account,
}: { account: Address }): Promise<HistoryItem[]> {
    // Get the paid item unlocked events for a user
    const unlockedItemsEvents = await getLogs(viemClient, {
        address: paywallAddress,
        event: paidItemUnlockedEventAbi,
        args: { user: account },
        strict: true,
        fromBlock: initialBlock,
    });

    // Map them to the ArticleUnlock type
    const unlockedItems: ArticleUnlock[] = await map(
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
                txDate: await getBlockDate(log.blockHash),
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

    // Get the frk received or sent events for a user
    function getFrkEvents(args: { to?: Address; from?: Address }) {
        return getLogs(viemClient, {
            address: addresses.frakToken,
            event: frkTransferEvent,
            args,
            strict: true,
            fromBlock: initialBlock,
        });
    }
    const frkReceivedEvents = await getFrkEvents({ to: account });
    const frkSentEvents = await getFrkEvents({ from: account });

    // Map them to the FrkReceived type
    const frkReceivedItems: FrkReceived[] = await map(
        frkReceivedEvents,
        async (log) => {
            const { value } = log.args;
            return {
                key: "frk-received",
                txHash: log.transactionHash,
                txDate: await getBlockDate(log.blockHash),
                fromHash: log.address,
                blockNumber: log.blockNumber,
                receivedAmount: formatEther(value),
            };
        }
    );

    // Map them to the FrkSent type
    const frkSentItems: FrkSent[] = await map(frkSentEvents, async (log) => {
        const { value } = log.args;
        return {
            key: "frk-sent",
            txHash: log.transactionHash,
            txDate: await getBlockDate(log.blockHash),
            toHash: log.address,
            blockNumber: log.blockNumber,
            sentAmount: formatEther(value),
        };
    });

    // Put all of that in one list and sort it
    const allItems = [...unlockedItems, ...frkReceivedItems, ...frkSentItems];
    return sort(allItems, (item) => Number(item.blockNumber), true);
}

/**
 * Cached version of the wallet history fetch
 */
export const fetchWalletHistory = unstable_cache(
    _fetchWalletHistory,
    ["fetch-wallet-history"],
    {
        // Keep that in server cache for 2min
        revalidate: 120,
    }
);

/**
 * Get the timestamp of the given block
 * @param blockHash
 */
async function getBlockDate(blockHash: Hash) {
    const block = await getBlock(viemClient, {
        blockHash,
        includeTransactions: false,
    });
    return new Date(Number(block.timestamp) * 1000);
}
