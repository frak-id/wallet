import type { Hex } from "viem";

export type HistoryItem = ArticleUnlock | FrkReceived | FrkSent;

/**
 * Represent an article unlocking history item
 */
export type ArticleUnlock = Readonly<{
    key: "article-unlock";
    txHash: Hex;
    blockNumber: bigint;
    txDate: Date;
    contentId: Hex;
    articleId: Hex;
    // Paid amount in FRK, formatted
    paidAmount: string;
    // Data about the unlock status
    allowedUntil: Date;
    isStillAllowed: boolean;
    remainingTimeInSec?: number;
    remainingTimeFormatted?: string;
}>;

/**
 * Represent an article unlocking history item
 */
export type FrkReceived = Readonly<{
    key: "frk-received";
    txHash: Hex;
    fromHash: Hex;
    blockNumber: bigint;
    txDate: Date;
    // The amount in FRK the wallet received
    receivedAmount: string;
}>;

export type FrkSent = Readonly<{
    key: "frk-sent";
    txHash: Hex;
    toHash: Hex;
    blockNumber: bigint;
    txDate: Date;
    // The amount in FRK the wallet received
    sentAmount: string;
}>;

/**
 * Represent an article unlocking history item with the front data
 */
export type ArticleUnlockWithFrontData = ArticleUnlock & {
    articleUrl?: string;
    articleTitle?: string;
    contentTitle?: string;
};

export type HistoryItemWithFrontData =
    | ArticleUnlockWithFrontData
    | FrkReceived
    | FrkSent;
