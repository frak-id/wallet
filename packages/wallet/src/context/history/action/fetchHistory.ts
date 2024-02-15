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
    HistoryItem,
} from "@/types/HistoryItem";
import { map, sort } from "radash";
import { type Address, type Hash, formatEther } from "viem";

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
export async function fetchWalletHistory({
    account,
}: { account: Address }): Promise<HistoryItem[]> {
    // Get the paid item unlocked events for a user
    const unlockedItemsEvents = await viemClient.getLogs({
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
                contentId,
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

    // Get the paid item unlocked events for a user
    const frkReceivedEvents = await viemClient.getLogs({
        address: addresses.frakToken,
        event: frkTransferEvent,
        args: { to: account },
        strict: true,
        fromBlock: initialBlock,
    });

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

    // Put all of that in one list and sort it
    const allItems = [...unlockedItems, ...frkReceivedItems];
    return sort(allItems, (item) => Number(item.blockNumber), true);
}

/**
 * Get the timestamp of the given block
 * @param blockHash
 */
async function getBlockDate(blockHash: Hash) {
    const block = await viemClient.getBlock({
        blockHash,
        includeTransactions: false,
    });
    return new Date(Number(block.timestamp) * 1000);
}
