import { formatUnits } from "viem";

/**
 * Render a token amount stored as base-units `bigint` into a human-friendly
 * string. Used by every merge surface that surfaces stablecoin balances
 * (preview recap card and migrate step holdings card) so the formatting
 * stays consistent between screens.
 *
 * 4 fraction digits matches the precision the wallet's send/balance views
 * use elsewhere — enough to disambiguate sub-cent balances without
 * spilling into noise.
 */
export function formatAmount(amount: bigint, decimals: number): string {
    const value = Number(formatUnits(amount, decimals));
    return value.toLocaleString(undefined, {
        maximumFractionDigits: 4,
    });
}
