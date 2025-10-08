import type { CredentialProps, CredentialPropsString } from "./types";

// COSE constants
export const EC2_TYPE = 2;
export const EC2_SHA256_ALGO = -7;

export function toStringCredentialProps(
    credentialProps: CredentialProps
): CredentialPropsString {
    return {
        credentialId: Buffer.from(credentialProps.credentialId).toString(
            "base64"
        ),
        privateKey: Buffer.from(credentialProps.privateKey).toString("base64"),
        aaguid: Buffer.from(credentialProps.aaguid).toString("base64"),
        publicKey: Buffer.from(credentialProps.publicKey).toString("base64"),
        cosePublicKey: Buffer.from(credentialProps.cosePublicKey).toString(
            "base64"
        ),
    };
}

export function fromStringCredentialProps(
    credentialProps: CredentialPropsString
) {
    return {
        credentialId: new Uint8Array(
            Buffer.from(credentialProps.credentialId, "base64")
        ),
        privateKey: new Uint8Array(
            Buffer.from(credentialProps.privateKey, "base64")
        ),
        aaguid: new Uint8Array(Buffer.from(credentialProps.aaguid, "base64")),
        publicKey: new Uint8Array(
            Buffer.from(credentialProps.publicKey, "base64")
        ),
        cosePublicKey: new Uint8Array(
            Buffer.from(credentialProps.cosePublicKey, "base64")
        ),
    };
}

export function getAuthenticatorDataFlags(
    userPresent = true,
    userVerified = true,
    backupEligible = false,
    backupState = false,
    attestedCredentialData = true,
    extensionDataIncluded = false
): number {
    let flags = 0;
    if (userPresent) flags |= 0x01; // User present
    if (userVerified) flags |= 0x04; // User verified
    if (backupEligible) flags |= 0x08; // Backup eligible
    if (backupState) flags |= 0x10; // Backup state
    if (attestedCredentialData) flags |= 0x40; // Attested credential data
    if (extensionDataIncluded) flags |= 0x80; // Extension data included
    return flags;
}
