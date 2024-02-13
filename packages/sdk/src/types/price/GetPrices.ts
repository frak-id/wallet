import type { Hex } from "viem";
import type { ArticlePrice } from "../ArticlePrice.ts";

/**
 * Get the article prices
 */
export type GetPricesParam = Readonly<{
    articleId: Hex;
    contentId: Hex;
}>;

/**
 * The response to the get prices request
 */
export type GetPricesResponse = Readonly<{
    id: string;
    prices: (ArticlePrice & {
        // Boolean to know if the prices are accessible for the user or not
        // Can be null if user not logged in
        isUserAccessible: boolean | null;
    })[];
}>;
