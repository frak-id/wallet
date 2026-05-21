import { currentStablecoinsList } from "@frak-labs/app-essentials";
import { useGetUserBalance } from "@frak-labs/wallet-shared";
import { useMemo } from "react";
import type { Address, Address as TokenAddress } from "viem";
import { useConnection } from "wagmi";

type UseLoserAssetCheckArgs = {
    loser?: Address;
};

type LoserAssetTokenSummary = {
    token: Address;
    symbol: string;
    name: string;
    amount: number;
    fiatAmount: number;
};

export type LoserAssetCheckResult = {
    /**
     * `true` when the current session belongs to the loser wallet — i.e. we
     * can use the authenticated balance endpoint to enumerate stablecoins.
     * `false` when the current session is the winner: the backend balance
     * endpoint only returns the JWT owner's balance, so we cannot inspect
     * the loser remotely yet. Phase 2 will close this gap; Phase 1 surfaces
     * a generic warning + checkbox in the UI instead.
     */
    canCheckLoser: boolean;
    /**
     * Stablecoin balances on the loser wallet with a non-zero amount.
     * `null` when we can't fetch them (loser is not the current session).
     */
    stablecoinBalances: LoserAssetTokenSummary[] | null;
    /**
     * Total fiat (EUR) value across the listed stablecoins. `null` when
     * unknown. Lets the UI render "$12.34 across 2 tokens" without
     * iterating the list itself.
     */
    totalFiatAmount: number | null;
    /** True when at least one stablecoin holds a non-zero balance. */
    hasDetectableFunds: boolean;
    isLoading: boolean;
};

/**
 * Phase 1 asset-warning helper for the wallet-merge flow.
 *
 * Backend constraint: the balance endpoint reads from the JWT, so we can
 * only enumerate the loser's funds when the current session IS the loser.
 * For the winner-current case we return `canCheckLoser = false` and let the
 * UI fall back to a generic "transfer any funds you might have" warning
 * gated by an explicit checkbox.
 *
 * The token list is filtered against {@link currentStablecoinsList} so the
 * recap is bounded to the assets the wallet actually treats as
 * transferable today — incidental tokens the wallet holds are out of scope
 * for Phase 1.
 */
export function useLoserAssetCheck({
    loser,
}: UseLoserAssetCheckArgs): LoserAssetCheckResult {
    const { address: currentAddress } = useConnection();
    const canCheckLoser = useMemo(() => {
        if (!loser || !currentAddress) return false;
        return loser.toLowerCase() === currentAddress.toLowerCase();
    }, [loser, currentAddress]);

    const { userBalance, isLoading } = useGetUserBalance();

    const stablecoinBalances = useMemo<LoserAssetTokenSummary[] | null>(() => {
        if (!canCheckLoser || !userBalance) return null;
        const stablecoinSet = new Set(
            (currentStablecoinsList as readonly TokenAddress[]).map((addr) =>
                addr.toLowerCase()
            )
        );
        return userBalance.balances
            .filter(
                (balance) =>
                    stablecoinSet.has(balance.token.toLowerCase()) &&
                    balance.amount > 0
            )
            .map((balance) => ({
                token: balance.token,
                symbol: balance.symbol,
                name: balance.name,
                amount: balance.amount,
                fiatAmount: balance.eurAmount,
            }));
    }, [canCheckLoser, userBalance]);

    const totalFiatAmount = useMemo(() => {
        if (!stablecoinBalances) return null;
        return stablecoinBalances.reduce(
            (acc, item) => acc + item.fiatAmount,
            0
        );
    }, [stablecoinBalances]);

    return {
        canCheckLoser,
        stablecoinBalances,
        totalFiatAmount,
        hasDetectableFunds:
            stablecoinBalances !== null && stablecoinBalances.length > 0,
        isLoading: canCheckLoser ? isLoading : false,
    };
}
