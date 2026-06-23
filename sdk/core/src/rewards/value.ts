import type { InteractionTypeKey } from "../constants/interactionTypes";
import type { Currency, EstimatedReward, TokenAmountType } from "../types";
import { getCurrencyAmountKey } from "../utils/format/getCurrencyAmountKey";
import { getSupportedCurrency } from "../utils/format/getSupportedCurrency";

/**
 * Comparable fiat value of a single reward, used to rank rewards against each
 * other.
 *
 * - `fixed`      → the token amount in the requested currency
 * - `tiered`     → the highest token amount across tiers
 * - `percentage` → the capped (`maxAmount`) value when present, otherwise `0`
 *                  (an uncapped percentage has no comparable fiat value)
 */
export function getRewardValue(
    reward: EstimatedReward,
    key: keyof TokenAmountType
): number {
    switch (reward.payoutType) {
        case "fixed":
            return reward.amount[key];
        case "percentage":
            return reward.maxAmount?.[key] ?? 0;
        case "tiered":
            return reward.tiers.reduce(
                (max, tier) =>
                    "amount" in tier ? Math.max(max, tier.amount[key]) : max,
                0
            );
    }
}

/**
 * Comparable value of a reward expressed in euros — the default ranking metric
 * for campaign selection.
 */
export function getRewardEurValue(reward: EstimatedReward): number {
    return getRewardValue(reward, "eurAmount");
}

/**
 * Minimal shape required to pick a reward out of a list of campaigns. Both the
 * lean merchant-information rewards (SDK, `interactionTypeKey: InteractionTypeKey`)
 * and the richer estimated-reward items (wallet/listener, where the backend
 * types it as a plain `string`) satisfy it — hence the widened key type.
 */
export type RewardCampaignLike = {
    interactionTypeKey: string;
    referrer?: EstimatedReward;
    referee?: EstimatedReward;
};

/**
 * Pick the highest-value reward across a list of campaigns.
 *
 * Selects the referrer reward by default, or the referee reward when
 * `context` is `"referred"`. Optionally filters by interaction type first.
 * Returns the reward itself (unformatted, no zero/empty policy applied) so
 * callers stay free to decide how to render or suppress low-value rewards.
 */
export function selectBestReward(
    campaigns: readonly RewardCampaignLike[],
    {
        currency,
        targetInteraction,
        context,
    }: {
        currency?: Currency;
        targetInteraction?: InteractionTypeKey;
        context?: string;
    } = {}
): EstimatedReward | undefined {
    const useReferrer = context !== "referred";
    const key = getCurrencyAmountKey(getSupportedCurrency(currency));

    const candidates = (
        targetInteraction
            ? campaigns.filter(
                  (c) => c.interactionTypeKey === targetInteraction
              )
            : campaigns
    )
        .map((c) => (useReferrer ? c.referrer : c.referee))
        .filter((r): r is EstimatedReward => r !== undefined);

    if (candidates.length === 0) return undefined;

    return candidates.reduce((best, current) =>
        getRewardValue(current, key) > getRewardValue(best, key)
            ? current
            : best
    );
}
