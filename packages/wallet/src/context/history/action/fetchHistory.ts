"use server";

import {
    frkTransferEvent,
    paidItemUnlockedEventAbi,
} from "@/context/blockchain/abis/event-abi";
import { getViemClientFromChainId } from "@/context/blockchain/provider";
import { formatSecondDuration } from "@/context/common/duration";
import type {
    ArticleUnlock,
    FrkReceived,
    FrkSent,
    HistoryItem,
} from "@/types/HistoryItem";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
import { unstable_cache } from "next/cache";
import { parallel, sort } from "radash";
import { type Address, formatEther, toHex } from "viem";
import { getBlock, getLogs } from "viem/actions";

/**
 * Get am account full history
 *   - In a non POC world, this shouldn't use getLogs, but instead use an indexed database like thegraph or pounder.sh
 * @param account
 * @param chainId
 */
async function _fetchWalletHistory({
    account,
    chainId,
}: {
    account: Address;
    chainId: number;
}): Promise<HistoryItem[]> {
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
    const unlockedItems: ArticleUnlock[] = await parallel(
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

    // Get the frk received or sent events for a user
    function getFrkEvents(args: { to?: Address; from?: Address }) {
        return getLogs(viemClient, {
            address: addresses.paywallToken,
            event: frkTransferEvent,
            args,
            strict: true,
            fromBlock: "earliest",
            toBlock: "latest",
        });
    }
    const frkReceivedEvents = await getFrkEvents({ to: account });
    const frkSentEvents = await getFrkEvents({ from: account });

    // Map them to the FrkReceived type
    const frkReceivedItems: FrkReceived[] = await parallel(
        2,
        frkReceivedEvents,
        async (log) => {
            const { value } = log.args;
            return {
                key: "frk-received",
                txHash: log.transactionHash,
                txDate: await getBlockDate({
                    blockNumber: log.blockNumber,
                    chainId,
                }),
                fromHash: log.address,
                blockNumber: log.blockNumber,
                receivedAmount: formatEther(value),
            };
        }
    );

    // Map them to the FrkSent type
    const frkSentItems: FrkSent[] = await parallel(
        2,
        frkSentEvents,
        async (log) => {
            const { value } = log.args;
            return {
                key: "frk-sent",
                txHash: log.transactionHash,
                txDate: await getBlockDate({
                    blockNumber: log.blockNumber,
                    chainId,
                }),
                toHash: log.address,
                blockNumber: log.blockNumber,
                sentAmount: formatEther(value),
            };
        }
    );

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
        // Keep that in server cache for 10min
        revalidate: 10 * 60,
    }
);

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

const getBlockDate = unstable_cache(_getBlockDate, ["get-block-date"], {
    // Keep that in server cache for 30 days
    revalidate: 720 * 60 * 60,
});
