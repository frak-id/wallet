import { stringToHex } from "viem";

/**
 * Convert a string to a bytes32
 * @param str
 */
export function stringToBytes32(str: string) {
    return stringToHex(str.replace(/[^a-zA-Z0-9]/g, "").substring(0, 32), {
        size: 32,
    });
}
