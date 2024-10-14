import type { P256Signature, WebAuthNSignature } from "@/types/WebAuthN";
import { ECDSASigValue } from "@peculiar/asn1-ecc";
import { AsnParser } from "@peculiar/asn1-schema";
import { base64URLStringToBuffer } from "@simplewebauthn/browser";
import type { AuthenticationResponseJSON } from "@simplewebauthn/types";
import { toHex } from "viem";
import { polygon, polygonMumbai } from "viem/chains";

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
 * Check if a chain support the RIP-7212
 * @param chainId
 */
export function isRip7212ChainSupported(chainId: number) {
    return chainId === polygonMumbai.id || chainId === polygon.id;
}
