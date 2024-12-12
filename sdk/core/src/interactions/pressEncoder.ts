import { type Hex, concatHex, pad, toHex } from "viem";
import { interactionTypes } from "../constants/interactionTypes";
import { productTypes } from "../constants/productTypes";
import type { PreparedInteraction } from "../types";

/**
 * Press interactions allow you to track user engagement with articles or other press content on your platform.
 * After setting up these interactions, you can create acquisition campaign based on the user engagement with your press content.
 *
 * <Callout type="info">
 *   To properly handle press interactions, ensure that the "Press" product type is enabled in your Business dashboard.
 * </Callout>
 *
 * {@link PreparedInteraction} The prepared interaction object that can be sent
 * @category Interactions Encoder
 *
 * @see {@link sendInteraction} Action used to send the prepared interaction to the Frak Wallet.
 */
export const PressInteractionEncoder = {
    /**
     * Encode an open article interaction
     * @param articleId The id of the article the user opened (32 bytes), could be a `keccak256` hash of the article slug, or your internal id
     */
    openArticle({ articleId }: { articleId: Hex }): PreparedInteraction {
        const interactionData = concatHex([
            interactionTypes.press.openArticle,
            pad(articleId, { size: 32 }),
        ]);
        return {
            handlerTypeDenominator: toHex(productTypes.press),
            interactionData,
        };
    },

    /**
     * Encode a read article interaction
     * @param articleId The id of the article the user opened (32 bytes), could be a `keccak256` hash of the article slug, or your internal id
     */
    readArticle({ articleId }: { articleId: Hex }): PreparedInteraction {
        const interactionData = concatHex([
            interactionTypes.press.readArticle,
            pad(articleId, { size: 32 }),
        ]);
        return {
            handlerTypeDenominator: toHex(productTypes.press),
            interactionData,
        };
    },
};
