import { createHash } from "node:crypto";
import { bufferToBase64URLString } from "@frak-labs/wallet-shared/common/utils/base64url";
import { p256 } from "@noble/curves/nist.js";
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
    challenge: string,
    origin: string
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
        challenge,
        origin,
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

    // Sign with a single SHA-256 via `prehash`. Hashing first and signing the
    // digest double-hashes — the verifier (WebCrypto / ox) hashes the raw data
    // once, so the signature must be over sha256(verifyData).
    const signature = p256.sign(verifyData, authenticator.privateKey, {
        format: "der",
        prehash: true,
    });

    // Build the attestation object
    const attestationStmtMap = new Map<string, number | Uint8Array>();
    attestationStmtMap.set("alg", EC2_SHA256_ALGO);
    // node-cbor encodes a plain Uint8Array as a tagged typed array (CBOR
    // tag 64), which @simplewebauthn does not unwrap — it then reads an empty
    // signature ("Input buffer has zero length"). A Buffer encodes as a plain
    // CBOR byte string, which the verifier handles.
    attestationStmtMap.set("sig", Buffer.from(signature));

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
            // `AuthenticatorAttestationResponse.getPublicKey()` must return a
            // DER SubjectPublicKeyInfo (SPKI) — ox feeds it straight into
            // `crypto.subtle.importKey("spki", …)`. Prepend the standard P-256
            // SPKI header to the raw uncompressed key (0x04‖x‖y).
            publicKey: Buffer.concat([
                Buffer.from(
                    "3059301306072a8648ce3d020106082a8648ce3d030107034200",
                    "hex"
                ),
                Buffer.from(authenticator.publicKey),
            ]).toString("base64url"),
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
    requestOptions: CredentialRequestOptions,
    credentialProps: CredentialPropsString,
    challenge: string,
    origin: string
): GetResponse | null {
    const authenticator = fromStringCredentialProps(credentialProps);
    if (!authenticator) {
        console.error("No credential props to get registration response");
        return null;
    }

    // Client data part
    const clientData = {
        type: "webauthn.get",
        challenge,
        origin,
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
        .update(requestOptions.publicKey?.rpId ?? "")
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

    // Sign with a single SHA-256 via `prehash`. Hashing first and signing the
    // digest double-hashes — the verifier (WebCrypto / ox) hashes the raw data
    // once, so the signature must be over sha256(verifyData).
    const signature = p256.sign(verifyData, authenticator.privateKey, {
        format: "der",
        prehash: true,
    });

    return {
        id: bufferToBase64URLString(
            authenticator.credentialId as unknown as ArrayBuffer
        ),
        rawId: authenticator.credentialId as unknown as ArrayBuffer,
        type: "public-key",
        authenticatorAttachment: "platform",
        response: {
            authenticatorData: Buffer.from(authData).toString("base64url"),
            signature: Buffer.from(signature).toString("base64url"),
            clientDataJSON: Buffer.from(clientDataJSON).toString("base64url"),
            userHandle: Buffer.from(
                authenticator.credentialId as unknown as ArrayBuffer
            ).toString("base64url"),
        },
    } satisfies GetResponse;
}
