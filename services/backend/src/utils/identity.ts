import type { Hex } from "viem";

/**
 * Encode an identity group UUID to a bytes32 userId for on-chain use.
 * Strips hyphens and left-pads with zeros to 32 bytes.
 */
export function encodeUserId(identityGroupId: string): Hex {
    const uuidWithoutHyphens = identityGroupId.replace(/-/g, "");
    return `0x${uuidWithoutHyphens.padStart(64, "0")}` as Hex;
}
