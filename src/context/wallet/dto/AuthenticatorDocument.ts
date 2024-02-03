import type { P256PubKey } from "@/types/WebAuthN";
import type {
    AuthenticatorTransportFuture,
    CredentialDeviceType,
} from "@simplewebauthn/types";
import type { ObjectId } from "mongodb";

/**
 * Represent a authenticator for a user
 */
export type AuthenticatorDocument = Readonly<{
    // This is the credential id
    _id: string;
    // The user id
    userId: ObjectId;
    // The user agent from the device where it came from
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
