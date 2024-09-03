import { type Hex, concatHex, pad, toHex } from "viem";
import { productTypes } from "../constants/productTypes";
import type { PreparedInteraction } from "../types";

/**
 * All the press interactions actions
 */
export const PressActionsSelector = {
    OpenArticle: "0xc0a24ffb",
    ReadArticle: "0xd5bd0fbe",
} as const;

/**
 * Encode an open article interaction
 * @param articleId
 */
function openArticle({ articleId }: { articleId: Hex }): PreparedInteraction {
    const interactionData = concatHex([
        PressActionsSelector.OpenArticle,
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
        PressActionsSelector.ReadArticle,
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
