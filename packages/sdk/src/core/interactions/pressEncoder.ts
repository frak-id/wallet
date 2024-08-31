import { type Hex, concatHex, pad } from "viem";
import type { PreparedInteraction } from "../types";

/**
 * Denominator for the press product type
 */
const PressTypeSelector = "0x02";

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
        handlerTypeDenominator: PressTypeSelector,
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
        handlerTypeDenominator: PressTypeSelector,
        interactionData,
    };
}

export const PressInteractionEncoder = {
    openArticle,
    readArticle,
};
