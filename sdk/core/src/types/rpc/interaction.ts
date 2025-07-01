import type { Address, Hex } from "viem";

/**
 * Represent a prepared user interaction, ready to be sent on-chain via the wallet
 */
export type PreparedInteraction = {
    handlerTypeDenominator: Hex;
    interactionData: Hex;
};

/**
 * Parameters that will be used to send an interaction to the blockchain
 * @inline
 */
export type SendInteractionParamsType = {
    /**
     * The product id where this interaction has been made
     * @defaultValue keccak256(toHex(window.location.host))
     */
    productId?: Hex;
    /**
     * The prepared interaction, built from an Interaction Encoder
     */
    interaction: PreparedInteraction;
    /**
     * A pre-computed interaction signature
     * If none provided, the delegated interaction validator of your product will sign it (you can manage it in the business dashboard)
     *
     * @defaultValue undefined
     */
    validation?: Hex;
    /**
     * The campaign id for scoped campaign targeting
     * If provided, the interaction will be associated with this specific campaign
     *
     * @defaultValue undefined
     */
    campaignId?: Address;
};

/**
 * Return type of the send interaction rpc request
 * @group RPC Schema
 */
export type SendInteractionReturnType = {
    /**
     * The id of the interaction in the interaction pool
     */
    delegationId: string;
};
