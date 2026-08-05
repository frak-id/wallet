import { type Address, slice } from "viem";

/**
 * Truncate an address to its first 3 bytes (`0x` + 6 hex chars) and last 4
 * bytes (8 hex chars), e.g. `0x123456...12345678`.
 *
 * Single source of truth for address truncation in the wallet. Two divergent
 * copies previously rendered `0x1234…abcd` (4 trailing chars, U+2026) in the
 * merge and recovery flows — the two places that ask a user to *verify* an
 * address — so the same wallet displayed differently depending on the screen.
 * Keep one format: more trailing characters make a checksum comparison
 * meaningfully harder to spoof.
 */
export function shortenAddress(address: Address): string {
    // `slice` throws `SliceOffsetOutOfBoundsError` on anything shorter than
    // the requested byte range. These screens render backend-supplied values,
    // so degrade to the raw string rather than throwing mid-render.
    // 3 leading + 4 trailing bytes = 14 hex chars, plus the "0x" prefix.
    if (address.length < 2 + 14) return address;
    const start = slice(address, 0, 3); // "0x" + first 3 bytes
    const end = slice(address, -4).replace("0x", ""); // last 4 bytes
    return `${start}...${end}`;
}
