/**
 * Custom types for WebAuthn credentials (ox-compatible)
 * These replace @simplewebauthn/browser types after migration to ox library
 */

export type AuthenticatorTransportFuture =
    | "ble"
    | "cable"
    | "hybrid"
    | "internal"
    | "nfc"
    | "smart-card"
    | "usb";

export type RegistrationCredential = PublicKeyCredential & {
    response: AuthenticatorAttestationResponse;
    authenticatorAttachment?: AuthenticatorAttachment;
};

export type AuthenticationCredential = PublicKeyCredential & {
    response: AuthenticatorAssertionResponse;
    authenticatorAttachment?: AuthenticatorAttachment;
};

export type CredentialProps = {
    credentialId: Uint8Array;
    privateKey: Uint8Array;
    publicKey: Uint8Array;
    aaguid: Uint8Array;
    cosePublicKey: Uint8Array;
};

export type CredentialPropsString = {
    credentialId: string;
    privateKey: string;
    aaguid: string;
    publicKey: string;
    cosePublicKey: string;
};

/* -------------------------------------------------------------------------- */
/*                                  Creation                                  */
/* -------------------------------------------------------------------------- */

export type ParsableAuthenticatorAttestationResponse = Omit<
    AuthenticatorAttestationResponse,
    | "getPublicKey"
    | "getPublicKeyAlgorithm"
    | "getTransports"
    | "getAuthenticatorData"
    | "attestationObject"
    | "clientDataJSON"
> & {
    attestationObject: string;
    clientDataJSON: string;
    publicKey: string;
    publicKeyAlgorithm: number;
    transports: AuthenticatorTransportFuture[];
    authenticatorData: string;
};

export type CreateResponse = Omit<
    RegistrationCredential,
    "response" | "getClientExtensionResults"
> & {
    response: ParsableAuthenticatorAttestationResponse;
};

/* -------------------------------------------------------------------------- */
/*                                     Get                                    */
/* -------------------------------------------------------------------------- */

export type ParsableAuthenticatorAssertionResponse = Omit<
    AuthenticatorAssertionResponse,
    "authenticatorData" | "signature" | "userHandle" | "clientDataJSON"
> & {
    authenticatorData: string;
    signature: string;
    userHandle: string;
    clientDataJSON: string;
};

export type GetResponse = Omit<
    AuthenticationCredential,
    "getClientExtensionResults" | "response"
> & {
    response: ParsableAuthenticatorAssertionResponse;
};
