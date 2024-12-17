import type { AuthenticatorTransportFuture } from "@simplewebauthn/browser";
import type { Address } from "viem";

/**
 * Interface representing a previously used authenticator model
 */
export type PreviousAuthenticatorModel = {
    wallet: Address;
    authenticatorId: string;
    transports?: AuthenticatorTransportFuture[];
};
