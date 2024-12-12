import type { Hex } from "viem";
import type { SiweMessage } from "viem/siwe";
import type { GenericModalStepType } from "./generic";

/**
 * Parameters of the send transaction rpc request
 */
export type SiweAuthenticationParams = Omit<
    SiweMessage,
    "address" | "chainId" | "expirationTime" | "issuedAt" | "notBefore"
> & {
    expirationTimeTimestamp?: number;
    notBeforeTimestamp?: number;
};

/**
 * Return type of the send transaction rpc request
 * @inline
 * @ignore
 */
export type SiweAuthenticateReturnType = Readonly<{
    signature: Hex;
    message: string;
}>;

/**
 * The SIWE authentication step for a Modal
 *
 * **Input**: SIWE message parameters
 * **Output**: SIWE result (message signed and wallet signature)
 *
 * @group Modal Display
 */
export type SiweAuthenticateModalStepType = GenericModalStepType<
    "siweAuthenticate",
    { siwe: SiweAuthenticationParams },
    SiweAuthenticateReturnType
>;
