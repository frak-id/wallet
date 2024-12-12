import type { Hex } from "viem";

/**
 * Represent a prepared user interaction, ready to be sent on-chain via the wallet
 */
export type PreparedInteraction = Readonly<{
    handlerTypeDenominator: Hex;
    interactionData: Hex;
}>;

/**
 * Parameters that will be used to send an interaction to the blockchain
 * @inline
 */
export type SendInteractionParamsType = {
    productId?: Hex; // If null will be recomputed from domain
    interaction: PreparedInteraction;
    validation?: Hex;
};

/**
 * Return type of the send interaction rpc request
 * @group RPC Schema
 */
export type SendInteractionReturnType = Readonly<{
    /**
     * The id of the interaction in the interaction pool
     */
    delegationId: string;
}>;
