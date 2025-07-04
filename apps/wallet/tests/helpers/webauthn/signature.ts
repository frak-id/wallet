import { createHash } from "node:crypto";
import { p256 } from "@noble/curves/p256";
import {
    type AuthenticationCredential,
    bufferToBase64URLString,
} from "@simplewebauthn/browser";
import type {
    CreateResponse,
    CredentialPropsString,
    GetResponse,
} from "./types";
import {
    EC2_SHA256_ALGO,
    fromStringCredentialProps,
    getAuthenticatorDataFlags,
} from "./utils";

/**
 * Get a registration response for a public key credential.
 */
export async function getRegistrationResponse(
    creationsOptions: { publicKey: PublicKeyCredentialCreationOptions },
    credentialProps: CredentialPropsString,
    challenge: string
): Promise<CreateResponse | null> {
    const cbor = await import("cbor");
    const encodeOne = cbor.default.encodeOne;

    const authenticator = fromStringCredentialProps(credentialProps);
    if (!authenticator) {
        console.error("No credential props to get registration response");
        return null;
    }

    // Credential data part
    const clientData = {
        type: "webauthn.create",
        challenge: challenge,
        origin: "https://localhost:3000",
        crossOrigin: false,
    };
    const clientDataJSON = Buffer.from(JSON.stringify(clientData));

    const credentialIdLength = Buffer.alloc(2);
    credentialIdLength.writeUInt16BE(authenticator.credentialId.length, 0);
    const credData = Buffer.concat([
        authenticator.aaguid,
        credentialIdLength, // 2-byte big-endian
        authenticator.credentialId,
        authenticator.cosePublicKey,
    ]);

    // RP ID hash
    const rpIdHash = createHash("sha256")
        .update(creationsOptions.publicKey.rp.id ?? "")
        .digest();

    // Authenticator data
    const authData = Buffer.concat([
        rpIdHash,
        Buffer.from([getAuthenticatorDataFlags()]),
        Buffer.alloc(4, 0), // Counter
        credData,
    ]);

    // Client data hash
    const clientDataHash = createHash("sha256").update(clientDataJSON).digest();
    const verifyData = Buffer.concat([authData, clientDataHash]);
    const digest = createHash("sha256").update(verifyData).digest();

    // Sign it
    const signature = p256.sign(digest, authenticator.privateKey);

    // Build the attestation object
    const attestationStmtMap = new Map<string, number | Uint8Array>();
    attestationStmtMap.set("alg", EC2_SHA256_ALGO);
    attestationStmtMap.set("sig", Buffer.from(signature.toDERHex(), "hex"));

    const attestationObjMap = new Map<
        string,
        string | Buffer | typeof attestationStmtMap
    >();
    attestationObjMap.set("fmt", "packed");
    attestationObjMap.set("authData", authData);
    attestationObjMap.set("attStmt", attestationStmtMap);

    const attestationObject = encodeOne(attestationObjMap);

    return {
        id: bufferToBase64URLString(
            authenticator.credentialId as unknown as ArrayBuffer
        ),
        type: "public-key",
        rawId: authenticator.credentialId as unknown as ArrayBuffer,
        authenticatorAttachment: "platform",
        response: {
            attestationObject:
                Buffer.from(attestationObject).toString("base64url"),
            clientDataJSON: Buffer.from(clientDataJSON).toString("base64url"),
            publicKey: Buffer.from(authenticator.publicKey).toString(
                "base64url"
            ),
            publicKeyAlgorithm: EC2_SHA256_ALGO,
            transports: ["internal"],
            authenticatorData: Buffer.from(authData).toString("base64url"),
        },
    } satisfies CreateResponse;
}

/**
 * Get an authentication response for a public key credential.
 */
export function getAuthenticationResponse(
    requestOptions: PublicKeyCredentialRequestOptions,
    credentialProps: CredentialPropsString,
    challenge: string
): AuthenticationCredential | null {
    const authenticator = fromStringCredentialProps(credentialProps);
    if (!authenticator) {
        console.error("No credential props to get registration response");
        return null;
    }

    // Client data part
    const clientData = {
        type: "webauthn.get",
        challenge: challenge,
        origin: requestOptions.rpId,
        crossOrigin: false,
    };
    const clientDataJSON = Buffer.from(JSON.stringify(clientData));

    // todo: Missing info about the key right now
    const credentialIdLength = Buffer.alloc(2);
    credentialIdLength.writeUInt16BE(authenticator.credentialId.length, 0);
    const credData = Buffer.concat([
        authenticator.aaguid,
        credentialIdLength, // 2-byte big-endian
        authenticator.credentialId,
        authenticator.cosePublicKey,
    ]);

    // RP ID hash
    const rpIdHash = createHash("sha256")
        .update(requestOptions.rpId ?? "")
        .digest();

    // Authenticator data
    const authData = Buffer.concat([
        rpIdHash,
        Buffer.from([getAuthenticatorDataFlags()]),
        Buffer.alloc(4, 0), // Counter
        credData,
    ]);

    // Client data hash
    const clientDataHash = createHash("sha256").update(clientDataJSON).digest();
    const verifyData = Buffer.concat([authData, clientDataHash]);
    const digest = createHash("sha256").update(verifyData).digest();

    // Sign it
    const signature = p256.sign(digest, authenticator.privateKey);

    return {
        id: bufferToBase64URLString(
            authenticator.credentialId as unknown as ArrayBuffer
        ),
        rawId: authenticator.credentialId as unknown as ArrayBuffer,
        type: "public-key",
        authenticatorAttachment: "platform",
        response: {
            authenticatorData: Buffer.from(authData).toString("base64url"),
            signature: Buffer.from(signature.toDERHex(), "hex").toString(
                "base64url"
            ),
            clientDataJSON: Buffer.from(clientDataJSON).toString("base64url"),
            userHandle: Buffer.from(
                authenticator.credentialId as unknown as ArrayBuffer
            ).toString("base64url"),
        },
    } satisfies GetResponse;
}
