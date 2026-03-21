import type {
    AuthenticatorTransportFuture,
    CredentialDeviceType,
} from "@simplewebauthn/server";
import type { Address, Hex } from "viem";

/**
 * Represent a authenticator for a user
 */
export type AuthenticatorDocument = Readonly<{
    // This is the credential id
    _id: string;
    // The smart wallet address associated with it
    smartWalletAddress?: Address;
    // The user agent from the device where it came from
    userAgent: string;
    // The extracted pub key
    publicKey: {
        x: Hex;
        y: Hex;
    };
    // The credential public key (base64 encoded)
    credentialPublicKey: string;
    counter: number;
    credentialDeviceType: CredentialDeviceType;
    credentialBackedUp: boolean;
    transports?: AuthenticatorTransportFuture[];
}>;
