import type { Hex } from "viem";

/**
 * Encode an identity group UUID to a bytes32 userId for on-chain use.
 * Strips hyphens and left-pads with zeros to 32 bytes.
 */
export function encodeUserId(identityGroupId: string): Hex {
    const uuidWithoutHyphens = identityGroupId.replace(/-/g, "");
    return `0x${uuidWithoutHyphens.padStart(64, "0")}` as Hex;
}

/**
 * Decode a bytes32 userId back to a UUID string.
 */
export function decodeUserId(userId: Hex): string {
    const hex = userId.slice(2).replace(/^0+/, "");
    if (hex.length !== 32) {
        throw new Error(`Invalid userId length: ${hex.length}`);
    }
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
