import type { AuthenticatorTransportFuture } from "@simplewebauthn/browser";

type PublicKeyCredentialRequestOptionsJSON = {
    challenge: string;
    timeout?: number;
    rpId?: string;
    allowCredentials?: {
        id: string;
        type: "public-key";
        transports?: AuthenticatorTransportFuture[];
    }[];
    userVerification?: UserVerificationRequirement;
};

/**
 * Generate authentication options for WebAuthn
 * Browser-compatible implementation without @simplewebauthn/server
 */
export function generateAuthenticationOptions(options: {
    rpID: string;
    allowCredentials?: {
        id: string;
        transports?: AuthenticatorTransportFuture[];
    }[];
    userVerification?: UserVerificationRequirement;
    challenge?: Uint8Array;
    timeout?: number;
}): PublicKeyCredentialRequestOptionsJSON {
    const challenge =
        options.challenge ?? crypto.getRandomValues(new Uint8Array(32));

    return {
        challenge: bufferToBase64URLString(challenge),
        timeout: options.timeout ?? 60000,
        rpId: options.rpID,
        allowCredentials: options.allowCredentials?.map((cred) => ({
            id: cred.id,
            type: "public-key",
            transports: cred.transports,
        })),
        userVerification: options.userVerification ?? "preferred",
    };
}

/**
 * Convert buffer to base64url string
 */
function bufferToBase64URLString(buffer: Uint8Array): string {
    const base64 = btoa(String.fromCharCode(...buffer));
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
