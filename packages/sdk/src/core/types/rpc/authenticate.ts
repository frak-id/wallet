import type { Hex } from "viem";
import type { SiweMessage } from "viem/siwe";

/**
 * Parameters of the send transaction rpc request
 */
export type AuthenticateRpcParamsType = [
    request: SiweAuthenticationParams,
    context?: string,
];

export type SiweAuthenticationParams = Omit<SiweMessage, "address" | "chainId">;

/**
 * Same stuff but in an object format for better readability
 */
export type AuthenticateActionParamsType = Readonly<{
    siwe: Partial<SiweAuthenticationParams>;
    context?: string;
}>;

/**
 * Return type of the send transaction rpc request
 */
export type AuthenticateReturnType = AuthenticateSuccess | AuthenticateError;

type AuthenticateSuccess = Readonly<{
    key: "success";
    signature: Hex;
    message: SiweMessage;
}>;
type AuthenticateError = Readonly<{
    key: "error" | "aborted";
    reason?: string;
}>;
