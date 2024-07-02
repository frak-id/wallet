import type { Hex } from "viem";

export type PreparedInteraction = Readonly<{
    handlerTypeDenominator: Hex;
    interactionData: Hex;
}>;

/**
 * Parameters of an interaction handling request
 */
export type SendInteractionParamsType = {
    contentId: Hex;
    interaction: PreparedInteraction;
    validation?: Hex;
};

/**
 * Parameters of an interaction handling rpc request
 */
export type SendInteractionRpcParamsType = [
    contentId: Hex,
    interaction: PreparedInteraction,
    validation?: Hex,
];
/**
 * Return type of the send interaction rpc request
 */
export type SendInteractionReturnType =
    | SendInteractionSuccess
    | SendInteractionError;

type SendInteractionSuccess = Readonly<{
    key: "success";
    transactionHash: Hex;
}>;
type SendInteractionError = Readonly<{
    key: "error" | "no_session" | "invalid_signature";
    reason?: string;
}>;
