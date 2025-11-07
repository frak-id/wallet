import {
    boolToHex,
    concatHex,
    type Hex,
    maxUint256,
    numberToHex,
    pad,
    size,
} from "viem";

/**
 * Format the given signature for blockchain submission
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
