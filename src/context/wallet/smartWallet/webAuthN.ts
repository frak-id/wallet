import type { P256Signature } from "@/types/WebAuthN";
import { ECDSASigValue } from "@peculiar/asn1-ecc";
import { AsnParser } from "@peculiar/asn1-schema";
import { base64URLStringToBuffer } from "@simplewebauthn/browser";
import { decodeCredentialPublicKey } from "@simplewebauthn/server/helpers";
import type { AuthenticationResponseJSON } from "@simplewebauthn/types";
import { toHex } from "viem";

/**
 * The RP ID for the webauthn
 */
export const rpId = process.env.IS_LOCAL === "true" ? "localhost" : "frak.id";
export const rpOrigin =
    process.env.IS_LOCAL === "true"
        ? "http://localhost:3000"
        : "https://poc-wallet.frak.id";

/**
 * Decode the public key from the attestation object
 * @param credentialPubKey
 */
export function decodePublicKey({
    credentialPubKey,
}: { credentialPubKey: Uint8Array }) {
    const publicKey = decodeCredentialPublicKey(
        credentialPubKey
    ) as unknown as {
        get(key: DecodedPubKeyIndexes.kty): number | undefined;
        get(key: DecodedPubKeyIndexes.alg): number | undefined;
        get(key: DecodedPubKeyIndexes.crv): DecodedPubKeyCrv | undefined;
        get(key: DecodedPubKeyIndexes.x): Uint8Array | undefined;
        get(key: DecodedPubKeyIndexes.y): Uint8Array | undefined;
    };

    const x = toHex(
        publicKey.get(DecodedPubKeyIndexes.x) ?? Uint8Array.from([])
    );
    const y = toHex(
        publicKey.get(DecodedPubKeyIndexes.y) ?? Uint8Array.from([])
    );

    return { x, y };
}

/**
 * The indexes zhere zhen can find each value in the decoded public key (matching the COSE curve)
 */
enum DecodedPubKeyIndexes {
    kty = 1,
    alg = 3,
    crv = -1,
    x = -2,
    y = -3,
    n = -1,
    e = -2,
}

/**
 * The different type of curves we knoz about the public key
 */
enum DecodedPubKeyCrv {
    P256 = 1,
    P384 = 2,
    P521 = 3,
    ED25519 = 6,
    SECP256K1 = 8,
}

/**
 * Verify a webauthn signature internally, and format it for blockchain transaction
 */
export function parseWebAuthNAuthentication({
    response,
}: AuthenticationResponseJSON) {
    // Extract the signature from the response
    const signature = parseSignature(
        base64URLStringToBuffer(response.signature)
    );

    const clientData = base64URLStringToBuffer(response.clientDataJSON);

    // Extract the challenge offset
    const challengeOffset =
        findChallengeOffset(new Uint8Array(clientData)) + 13;

    return {
        // Format client data and authenticator data
        clientData: toHex(new Uint8Array(clientData)),
        authenticatorData: toHex(
            new Uint8Array(base64URLStringToBuffer(response.authenticatorData))
        ),
        // Return sig + challenge offset
        challengeOffset,
        signature,
    };
}

/**
 * Parse the signature from the webauthn response
 * @param signature
 */
function parseSignature(signature: ArrayBuffer): P256Signature {
    const parsedSignature = AsnParser.parse(signature, ECDSASigValue);
    return {
        r: toHex(new Uint8Array(parsedSignature.r)),
        s: toHex(new Uint8Array(parsedSignature.s)),
    };
}
/**
 * Concatenate two Uint8Array
 * @param input
 */
function hexStringToUint8Array(input: string): Uint8Array {
    return new Uint8Array(
        input.match(/[\da-f]{2}/gi).map((h) => parseInt(h, 16))
    );
}

/**
 * This is the base64 url encoded prefix of the challenge, used to extract challenge offset
 */
const challengePrefix = "226368616c6c656e6765223a";

/**
 * Find a sequence in an array
 * @param arr
 */
function findChallengeOffset(arr: Uint8Array): number {
    // The target sequence to search for
    const targetSeq = hexStringToUint8Array(challengePrefix);

    // Iterate over the array
    for (let i = 0; i < arr.length; ++i) {
        for (let j = 0; j < targetSeq.length; j++) {
            if (arr[i + j] !== targetSeq[j]) {
                break;
            }
            if (j === targetSeq.length - 1) {
                return i;
            }
        }
    }
    return -1;
}
