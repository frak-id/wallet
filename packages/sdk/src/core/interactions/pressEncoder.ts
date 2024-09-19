import { type Hex, concatHex, pad, toHex } from "viem";
import { interactionTypes } from "../constants/interactionTypes";
import { productTypes } from "../constants/productTypes";
import type { PreparedInteraction } from "../types";

/**
 * Encode an open article interaction
 * @param articleId
 */
function openArticle({ articleId }: { articleId: Hex }): PreparedInteraction {
    const interactionData = concatHex([
        interactionTypes.press.openArticle,
        pad(articleId, { size: 32 }),
    ]);
    return {
        handlerTypeDenominator: toHex(productTypes.press),
        interactionData,
    };
}

/**
 * Encode a read article interaction
 * @param articleId
 */
function readArticle({ articleId }: { articleId: Hex }): PreparedInteraction {
    const interactionData = concatHex([
        interactionTypes.press.readArticle,
        pad(articleId, { size: 32 }),
    ]);
    return {
        handlerTypeDenominator: toHex(productTypes.press),
        interactionData,
    };
}

export const PressInteractionEncoder = {
    openArticle,
    readArticle,
};
