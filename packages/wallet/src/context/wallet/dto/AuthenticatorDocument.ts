import type { P256PubKey } from "@/types/WebAuthN";
import type {
    AuthenticatorTransportFuture,
    CredentialDeviceType,
} from "@simplewebauthn/types";

/**
 * Represent a authenticator for a user
 */
export type AuthenticatorDocument = Readonly<{
    // This is the credential id
    _id: string;
    // The user agent from the device where it came from
    username: string;
    userAgent: string;
    // The extracted pub key
    publicKey: P256PubKey;
    // The authenticator stuff
    credentialPublicKey: string;
    counter: number;
    credentialDeviceType: CredentialDeviceType;
    credentialBackedUp: boolean;
    transports?: AuthenticatorTransportFuture[];
}>;
