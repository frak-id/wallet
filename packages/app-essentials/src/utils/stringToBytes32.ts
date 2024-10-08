import { type Hex, hexToString, isHex, stringToHex } from "viem";

/**
 * Convert a string to a bytes32
 * @param str
 */
export function stringToBytes32(str: string) {
    // Replace every non-printable ascii char of the string
    const withoutAscii = str.replace(/[^\x20-\x7F]/g, "");

    // Map it to a hex
    return stringToHex(withoutAscii.substring(0, 32), {
        size: 32,
    });
}

export function bytesToString(bytes: Hex) {
    if (!isHex(bytes)) {
        return bytes;
    }
    return hexToString(bytes)
        .replace(/[^\x20-\x7F]/g, "")
        .trim();
}
