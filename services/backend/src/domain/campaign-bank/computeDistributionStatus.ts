import { type Address, formatUnits } from "viem";
import type { RewardDefinition } from "../campaign/schemas";
import type { DistributionStatus } from "./schemas";

type OnChainBankState = {
    isOpen: boolean;
    balances: Map<Address, bigint>;
    allowances: Map<Address, bigint>;
};

const REFERENCE_PURCHASE_AMOUNT = 100;
const LOW_FUNDS_REWARD_THRESHOLD = 10;

function getRewardAmount(reward: RewardDefinition): number {
    switch (reward.amountType) {
        case "fixed":
            return reward.amount;
        case "tiered":
            return Math.max(0, ...reward.tiers.map((t) => t.amount));
        case "percentage": {
            const calculated =
                (REFERENCE_PURCHASE_AMOUNT * reward.percent) / 100;
            const capped =
                reward.maxAmount !== undefined
                    ? Math.min(calculated, reward.maxAmount)
                    : calculated;
            return reward.minAmount !== undefined
                ? Math.max(capped, reward.minAmount)
                : capped;
        }
    }
}

/**
 * Max reward per token for a single event (referrer + referee summed).
 * - Fixed: amount directly
 * - Tiered: highest tier amount
 * - Percentage: percent of 100€ reference purchase, capped/floored
 */
function computeMaxRewardPerToken(
    rewards: RewardDefinition[]
): Map<Address, number> {
    const perToken = new Map<Address, number>();

    for (const reward of rewards) {
        if (!reward.token) continue;
        const amount = getRewardAmount(reward);
        const current = perToken.get(reward.token as Address) ?? 0;
        perToken.set(reward.token as Address, current + amount);
    }

    return perToken;
}

function checkLowFunds(
    onChainState: OnChainBankState,
    rewards: RewardDefinition[],
    tokenDecimals: Map<Address, number>
): boolean {
    const maxRewardPerToken = computeMaxRewardPerToken(rewards);

    for (const [token, maxReward] of maxRewardPerToken.entries()) {
        if (maxReward <= 0) continue;

        const balance = onChainState.balances.get(token) ?? 0n;
        if (balance <= 0n) continue;

        const decimals = tokenDecimals.get(token);
        if (decimals === undefined) continue;

        const allowance = onChainState.allowances.get(token) ?? 0n;
        const effective = allowance < balance ? allowance : balance;
        const humanEffective = Number(formatUnits(effective, decimals));

        if (humanEffective < maxReward * LOW_FUNDS_REWARD_THRESHOLD) {
            return true;
        }
    }

    return false;
}

function hasInsufficientAllowance(onChainState: OnChainBankState): boolean {
    for (const [token, balance] of onChainState.balances.entries()) {
        if (balance <= 0n) continue;
        const allowance = onChainState.allowances.get(token) ?? 0n;
        if (allowance < balance) return true;
    }
    return false;
}

/**
 * Per-campaign distribution status from on-chain bank state + campaign rewards.
 *
 * Priority: not_deployed → paused → depleted → low_funds → insufficient_allowance → distributing
 */
export function computeDistributionStatus(
    onChainState: OnChainBankState | null,
    rewards: RewardDefinition[],
    tokenDecimals: Map<Address, number>
): DistributionStatus {
    if (!onChainState) return "not_deployed";
    if (!onChainState.isOpen) return "paused";

    let totalBalance = 0n;
    for (const balance of onChainState.balances.values()) {
        totalBalance += balance;
    }
    if (totalBalance === 0n) return "depleted";

    if (checkLowFunds(onChainState, rewards, tokenDecimals)) {
        return "low_funds";
    }

    if (hasInsufficientAllowance(onChainState)) {
        return "insufficient_allowance";
    }

    return "distributing";
}
