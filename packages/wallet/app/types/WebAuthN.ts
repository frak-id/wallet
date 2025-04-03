import type { AuthenticatorTransportFuture } from "@simplewebauthn/browser";
import type { Address, Hex } from "viem";

/**
 * Represent a user WebAuthN wallet
 */
export type WebAuthNWallet = Readonly<{
    // Can be undefined for old wallet
    type?: "webauthn";
    // The address of the wallet
    address: Address;
    // The public key of the wallet
    publicKey: P256PubKey;
    // The authenticator id
    authenticatorId: string;
    // The transports of this authenticator
    transports?: AuthenticatorTransportFuture[];
}>;

/**
 * Represent a public key on the p265 curve
 */
export type P256PubKey = Readonly<{
    x: Hex;
    y: Hex;
}>;

/**
 * Represent a signature using the P256 curve
 */
export type P256Signature = Readonly<{
    r: Hex;
    s: Hex;
}>;

/**
 * The signature of a webauthn authentication
 */
export type WebAuthNSignature = Readonly<{
    authenticatorData: Hex;
    clientData: Hex;
    challengeOffset: bigint;
    signature: P256Signature;
}>;
