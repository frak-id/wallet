import { type Hex, concatHex, pad, toHex } from "viem";
import { interactionTypes } from "../constants/interactionTypes";
import { productTypes } from "../constants/productTypes";
import type { PreparedInteraction } from "../types";

/**
 * Encode a start purchase interaction
 */
function startPurchase({
    purchaseId,
}: { purchaseId: Hex }): PreparedInteraction {
    const interactionData = concatHex([
        interactionTypes.purchase.started,
        pad(purchaseId, { size: 32 }),
    ]);
    return {
        handlerTypeDenominator: toHex(productTypes.referral),
        interactionData,
    };
}

/**
 * Encode a complete purchase interaction
 */
function completedPurchase({
    purchaseId,
}: { purchaseId: Hex }): PreparedInteraction {
    const interactionData = concatHex([
        interactionTypes.purchase.completed,
        pad(purchaseId, { size: 32 }),
    ]);
    return {
        handlerTypeDenominator: toHex(productTypes.referral),
        interactionData,
    };
}

export const PurchaseInteractionEncoder = {
    startPurchase,
    completedPurchase,
};
