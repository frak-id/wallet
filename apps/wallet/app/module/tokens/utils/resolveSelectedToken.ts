import type { BalanceItem } from "@frak-labs/wallet-shared";
import { type Address, isAddressEqual } from "viem";

/**
 * Keyed by token address, never by object identity: a fresh `BalanceItem` on
 * every balance refetch would loop an effect that both reads and writes the
 * selection. Falls back to the first balance so a token that disappears from
 * the list degrades to a valid entry instead of a stale amount.
 */
export function resolveSelectedToken({
    tokens,
    selectedAddress,
}: {
    tokens: BalanceItem[] | undefined;
    selectedAddress: Address | undefined;
}): BalanceItem | undefined {
    if (!tokens?.length) return undefined;
    if (!selectedAddress) return tokens[0];
    return (
        tokens.find(({ token }) => isAddressEqual(token, selectedAddress)) ??
        tokens[0]
    );
}
