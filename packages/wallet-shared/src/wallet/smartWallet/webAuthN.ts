import type {
    P256Signature,
    WebAuthNSignature,
} from "@frak-labs/wallet-shared/types/WebAuthN";
import { ECDSASigValue } from "@peculiar/asn1-ecc";
import { AsnParser } from "@peculiar/asn1-schema";
import {
    type AuthenticationResponseJSON,
    base64URLStringToBuffer,
} from "@simplewebauthn/browser";
import {
    boolToHex,
    concatHex,
    type Hex,
    maxUint256,
    numberToHex,
    pad,
    size,
    toHex,
} from "viem";

/**
 * Verify a webauthn signature internally, and format it for blockchain transaction
 */
export function parseWebAuthNAuthentication({
    response,
}: AuthenticationResponseJSON): WebAuthNSignature {
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
        challengeOffset: BigInt(challengeOffset),
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
        input.match(/[\da-f]{2}/gi)?.map((h) => Number.parseInt(h, 16)) ?? []
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
    const index = arr.findIndex((_, i) =>
        targetSeq.every((value, j) => arr[i + j] === value)
    );
    return index ?? -1;
}

/**
 * Format the given signature
 */
export function formatSignature({
    authenticatorIdHash,
    challengeOffset,
    rs,
    authenticatorData,
    clientData,
}: {
    authenticatorIdHash: Hex;
    challengeOffset: bigint;
    rs: [bigint, bigint];
    authenticatorData: Hex;
    clientData: Hex;
}) {
    return concatHex([
        // Metadata stuff
        pad(boolToHex(true), { size: 1 }), // RIP-7212 support -> always true on arbitrum / arbitrum sepolia
        pad(authenticatorIdHash, { size: 32 }),
        // Signature info
        numberToHex(challengeOffset, { size: 32, signed: false }),
        numberToHex(rs[0], { size: 32, signed: false }),
        numberToHex(rs[1], { size: 32, signed: false }),
        // The length of each bytes array (uint24 so 3 bytes)
        numberToHex(size(authenticatorData), { size: 3, signed: false }),
        numberToHex(size(clientData), { size: 3, signed: false }),
        // Then the bytes values
        authenticatorData,
        clientData,
    ]);
}

/**
 * Get a stub signature for the WebAuthN validator
 */
export function getStubSignature({
    authenticatorIdHash,
}: {
    authenticatorIdHash: Hex;
}) {
    // The max curve value for p256 signature stuff
    const maxCurveValue =
        BigInt(
            "0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551"
        ) - 1n;

    // Generate a template signature for the WebAuthN validator
    return formatSignature({
        authenticatorIdHash,
        challengeOffset: maxUint256,
        rs: [maxCurveValue, maxCurveValue],
        authenticatorData: `0x${maxUint256.toString(16).repeat(6)}`,
        clientData: `0x${maxUint256.toString(16).repeat(6)}`,
    });
}
