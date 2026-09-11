import { type Address, slice } from "viem";

/**
 * Truncate an address to its first 3 bytes and last 4 bytes, e.g.
 * `0x123456...12345678`. Single source of truth: the merge and recovery flows
 * ask the user to *verify* an address, and more trailing characters make a
 * checksum comparison harder to spoof — do not shorten the tail.
 */
export function shortenAddress(address: Address): string {
    // `slice` throws on anything shorter than the requested byte range, and
    // these screens render backend-supplied values: degrade to the raw string.
    if (address.length < 2 + 14) return address;
    const start = slice(address, 0, 3); // "0x" + first 3 bytes
    const end = slice(address, -4).replace("0x", ""); // last 4 bytes
    return `${start}...${end}`;
}
