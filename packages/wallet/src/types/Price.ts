import type { Hex } from "viem";

/**
 * Represent a generic article prices
 */
export type ArticlePrice = Readonly<{
    index: number; // Index of the price
    isPriceEnabled: boolean;
    frkAmount: Hex; // Hex representing a bigint
    unlockDurationInSec: number; // The duration for which this price unlock an article
}>;

/**
 * Represent a price for a user (null if not logged in, false if already unlock or not enough balance)
 */
export type ArticlePriceForUser = ArticlePrice & {
    readonly isUserAccessible: boolean | null;
};
