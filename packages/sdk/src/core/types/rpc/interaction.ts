import type { Hex } from "viem";

export type PreparedInteraction = Readonly<{
    handlerTypeDenominator: Hex;
    interactionData: Hex;
}>;

/**
 * Parameters of an interaction handling request
 */
export type SendInteractionParamsType = {
    contentId?: Hex; // If null will be recomputed from domain
    interaction: PreparedInteraction;
    validation?: Hex;
};

/**
 * Return type of the send interaction rpc request
 */
export type SendInteractionReturnType = Readonly<{
    hash: Hex;
}>;
