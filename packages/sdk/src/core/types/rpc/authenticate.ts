import type { Hex } from "viem";
import type { SiweMessage } from "viem/siwe";

/**
 * Parameters of the send transaction rpc request
 */
export type SiweAuthenticationParams = Omit<SiweMessage, "address" | "chainId">;

/**
 * Same stuff but in an object format for better readability
 */
export type SiweAuthenticateActionParamsType = Readonly<{
    siwe?: Partial<SiweAuthenticationParams>;
    context?: string;
}>;

/**
 * Return type of the send transaction rpc request
 */
export type SiweAuthenticateReturnType = Readonly<{
    signature: Hex;
    message: string;
}>;
