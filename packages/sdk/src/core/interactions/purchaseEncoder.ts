import { type Hex, concatHex, encodeAbiParameters, pad, toHex } from "viem";
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
        handlerTypeDenominator: toHex(productTypes.purchase),
        interactionData,
    };
}

/**
 * Encode a complete purchase interaction
 */
function completedPurchase({
    purchaseId,
    proof,
}: { purchaseId: Hex; proof: Hex[] }): PreparedInteraction {
    const innerData = encodeAbiParameters(
        [{ type: "uint256" }, { type: "bytes32[]" }],
        [BigInt(purchaseId), proof]
    );
    const interactionData = concatHex([
        interactionTypes.purchase.completed,
        innerData,
    ]);
    return {
        handlerTypeDenominator: toHex(productTypes.purchase),
        interactionData,
    };
}

export const PurchaseInteractionEncoder = {
    startPurchase,
    completedPurchase,
};
