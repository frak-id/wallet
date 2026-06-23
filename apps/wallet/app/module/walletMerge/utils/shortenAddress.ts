import type { Address } from "viem";

/**
 * Compact wallet-address renderer used across the merge flow.
 *
 * The merge UI doesn't expose chain ids, gas, or any other blockchain
 * vocabulary — the only piece end users recognise from their rewards screens
 * is the short address. Keep the same `0x1234…abcd` shape everywhere so the
 * user can connect "this account is the one with my rewards" without having
 * to read the full hex.
 */
export function shortenAddress(address: Address): string {
    if (address.length <= 12) return address;
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
