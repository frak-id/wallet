import type { BalanceItem } from "@frak-labs/wallet-shared";
import { type Address, isAddressEqual } from "viem";

/**
 * Resolve the balance entry a user is currently sending, keyed by token
 * address rather than by object identity.
 *
 * The send screen used to hold the whole `BalanceItem` in state and re-sync it
 * from an effect that both read *and* wrote `selectedToken`. That effect only
 * terminated because its lookup happened to return `undefined` once the
 * amounts converged — a fresh object on every balance refetch would have
 * looped forever, on the token-transfer screen. Deriving during render removes
 * the hazard entirely: state holds an address, the item is looked up.
 *
 * Falls back to the first balance so the screen always has a selection, and
 * so a token that disappears from the list (fully spent, delisted) degrades to
 * a valid entry instead of a stale amount.
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
