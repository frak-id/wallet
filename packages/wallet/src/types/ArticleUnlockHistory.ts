import type { ArticleProvider } from "@/context/common/dexie/ArticleInfoModel";
import type { Hex } from "viem";

/**
 * Represent an article unlocking history item
 */
export type ArticleUnlockHistory = Readonly<{
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
 * Represent an article unlocking history item with the front data
 */
export type ArticleUnlockHistoryWithFrontData = ArticleUnlockHistory & {
    articleUrl?: string;
    articleTitle?: string;
    contentTitle?: string;
    provider?: ArticleProvider;
};
