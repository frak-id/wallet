import type { Hex } from "viem";
import type { SiweMessage } from "viem/siwe";
import type { ModalStepType } from "./generic";

/**
 * Parameters of the send transaction rpc request
 */
export type SiweAuthenticationParams = Omit<SiweMessage, "address" | "chainId">;

/**
 * Return type of the send transaction rpc request
 */
export type SiweAuthenticateReturnType = Readonly<{
    signature: Hex;
    message: string;
}>;

/**
 * Generic type of modal we will display to the end user
 */
export type SiweAuthenticateModalStepType = ModalStepType<
    "siweAuthenticate",
    { siwe: Partial<SiweAuthenticationParams> },
    SiweAuthenticateReturnType
>;
