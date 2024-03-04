"use server";

import {
    addresses,
    paywallAddress,
} from "@/context/common/blockchain/addresses";
import { frakTokenAbi, paywallAbi } from "@/context/common/blockchain/frak-abi";
import { viemClient } from "@/context/common/blockchain/provider";
import type { ArticlePrice, ArticlePriceForUser } from "@/types/Price";
import { unstable_cache } from "next/cache";
import { type Hex, toHex } from "viem";
import { readContract } from "viem/actions";

/**
 * Get the prices for an article on the given `contentId`
 * @param contentId
 */
async function _getArticlePrices({
    contentId,
}: { contentId: Hex }): Promise<ArticlePrice[]> {
    // Read all the prices from the blockchain
    const prices = await readContract(viemClient, {
        address: paywallAddress,
        abi: paywallAbi,
        functionName: "getContentPrices",
        args: [BigInt(contentId)],
    });

    // Map and filter out all the prices that aren't enabled
    return prices
        .map((price, index) => ({
            index,
            isPriceEnabled: price.isPriceEnabled,
            frkAmount: toHex(price.price),
            unlockDurationInSec: Number(price.allowanceTime),
        }))
        .filter((p) => p.isPriceEnabled);
}

/**
 * Cached version of the article prices fetch
 */
const getArticlePrices = unstable_cache(
    _getArticlePrices,
    ["get-article-prices"],
    {
        revalidate: 3600,
    }
);

/**
 * Get the article prices for a user
 */
async function _getArticlePricesForUser({
    contentId,
    articleId,
    address,
}: { contentId: Hex; articleId: Hex; address?: Hex }): Promise<
    ArticlePriceForUser[]
> {
    // Get the initial article prices
    const prices = await getArticlePrices({ contentId });

    // If we didn't have any wallet, return price not enabled
    if (!address) {
        return prices.map((p) => ({
            ...p,
            isUserAccessible: null,
        }));
    }

    // Check if the user already unlocked an article
    const [isAllowed] = await readContract(viemClient, {
        address: paywallAddress,
        abi: paywallAbi,
        functionName: "isReadAllowed",
        args: [BigInt(contentId), articleId, address],
    });
    if (isAllowed) {
        return prices.map((p) => ({
            ...p,
            isUserAccessible: false,
        }));
    }

    // Get the frk balance of the user
    const userBalance = await readContract(viemClient, {
        address: addresses.frakToken,
        abi: frakTokenAbi,
        functionName: "balanceOf",
        args: [address],
    });

    // Map the prices with the user balance (to check if enabled or not)
    return prices.map((p) => ({
        ...p,
        isUserAccessible: userBalance >= BigInt(p.frkAmount),
    }));
}

/**
 * Cached version of the article prices for user fetch
 */
export const getArticlePricesForUser = unstable_cache(
    _getArticlePricesForUser,
    ["get-article-prices-for-user"],
    {
        // Keep that in cache for 5 minutes
        revalidate: 300,
    }
);

/**
 * Get an up to date price for a given article
 * TODO: Should expose a simpler blockchain method maybe?
 * @param contentId
 * @param priceIndex
 */
async function _getArticlePrice({
    contentId,
    priceIndex,
}: { contentId: Hex; priceIndex: number }): Promise<ArticlePrice | null> {
    // Read all the prices from the blockchain
    const prices = await readContract(viemClient, {
        address: paywallAddress,
        abi: paywallAbi,
        functionName: "getContentPrices",
        args: [BigInt(contentId)],
    });

    // Find the one at the given index
    const price = prices[priceIndex];
    if (!price?.isPriceEnabled) {
        return null;
    }

    // Return the price formatted
    return {
        index: priceIndex,
        frkAmount: toHex(price.price),
        unlockDurationInSec: Number(price.allowanceTime),
    };
}

/**
 * Cached version of the article price fetch
 */
export const getArticlePrice = unstable_cache(
    _getArticlePrice,
    ["get-article-price"],
    {
        // Keep in cache for an hour
        revalidate: 3600,
    }
);
