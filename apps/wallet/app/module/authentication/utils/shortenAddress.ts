import { type Address, slice } from "viem";

/**
 * Truncate an address to its first 3 bytes (`0x` + 6 hex chars) and last 4
 * bytes (8 hex chars), e.g. `0x123456...12345678`.
 */
export function shortenAddress(address: Address): string {
    const start = slice(address, 0, 3); // "0x" + first 3 bytes
    const end = slice(address, -4).replace("0x", ""); // last 4 bytes
    return `${start}...${end}`;
}
