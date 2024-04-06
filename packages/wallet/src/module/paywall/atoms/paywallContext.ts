import type { ArticlePrice } from "@/types/Price";
import { atomWithStorage } from "jotai/utils";
import type { Hex } from "viem";

/**
 * Represent the context of a paywall unlock
 */
export type PaywallContext = {
    // Content related
    contentId: Hex;
    contentTitle: string;
    imageUrl: string;
    // Article related
    articleId: Hex;
    articleTitle: string;
    // Price related
    price: ArticlePrice;
    // Url related
    articleUrl: string;
    redirectUrl: string;
    previewUrl?: string;
};

/**
 * Atom with the context in local storage
 */
export const paywallContextAtom = atomWithStorage<PaywallContext | null>(
    "paywallContext",
    null
);
