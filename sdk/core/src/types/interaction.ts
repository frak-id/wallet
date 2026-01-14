import type { Hex } from "viem";

/**
 * Prepared interaction data to be pushed to the backend
 * Used for tracking user interactions with products
 */
export type PreparedInteraction = {
    /**
     * The interaction handler type denominator (4-byte hex selector)
     */
    handlerTypeDenominator: Hex;
    /**
     * The encoded interaction data
     */
    interactionData: Hex;
};
