import type {
    AuthenticatorTransportFuture,
    CredentialDeviceType,
} from "@simplewebauthn/server";
import type { Address, Hex } from "viem";

export type AuthenticatorDocument = Readonly<{
    /** The WebAuthn credential id. */
    _id: string;
    smartWalletAddress?: Address;
    /** User agent of the device the credential was registered from. */
    userAgent: string;
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
