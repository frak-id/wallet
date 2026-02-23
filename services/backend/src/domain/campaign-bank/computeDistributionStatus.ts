import type { Address } from "viem";
import { formatUnits } from "viem";
import type { DistributionStatus } from "./schemas";

type OnChainBankState = {
    isOpen: boolean;
    balances: Map<Address, bigint>;
    allowances: Map<Address, bigint>;
};

/**
 * Arbitrary USD threshold — if any token balance falls below this,
 * the merchant gets a "warning" nudge to top-up.
 */
const LOW_BALANCE_THRESHOLD_USD = 50;

/**
 * Merchant-level distribution status from on-chain bank state.
 *
 * Priority: not_deployed → paused → depleted → warning → distributing
 *
 * - `warning` fires when any token has balance < $50 OR allowance < balance.
 */
export function computeDistributionStatus(
    onChainState: OnChainBankState | null,
    tokenDecimals: Map<Address, number>
): DistributionStatus {
    if (!onChainState) return "not_deployed";
    if (!onChainState.isOpen) return "paused";

    let totalBalance = 0n;
    for (const balance of onChainState.balances.values()) {
        totalBalance += balance;
    }
    if (totalBalance === 0n) return "depleted";

    for (const [token, balance] of onChainState.balances.entries()) {
        if (balance <= 0n) continue;

        const allowance = onChainState.allowances.get(token) ?? 0n;

        if (allowance < balance) return "warning";

        const decimals = tokenDecimals.get(token);
        if (decimals !== undefined) {
            const humanBalance = Number(formatUnits(balance, decimals));
            if (humanBalance < LOW_BALANCE_THRESHOLD_USD) return "warning";
        }
    }

    return "distributing";
}
