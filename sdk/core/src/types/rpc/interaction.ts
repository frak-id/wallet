import type { Hex } from "viem";

export type PreparedInteraction = Readonly<{
    handlerTypeDenominator: Hex;
    interactionData: Hex;
}>;

/**
 * Parameters of an interaction handling request
 * @inline
 */
export type SendInteractionParamsType = {
    productId?: Hex; // If null will be recomputed from domain
    interaction: PreparedInteraction;
    validation?: Hex;
};

/**
 * Return type of the send interaction rpc request
 */
export type SendInteractionReturnType = Readonly<{
    delegationId: string;
}>;
