import type { MerchantReward } from "@frak-labs/core-sdk";
import { getRewardValue } from "@frak-labs/core-sdk/rewards";

/**
 * Per-merchant sort values pulled from `estimated-rewards`. Interim until
 * `/explore` carries reward/expiry directly.
 */
export type MerchantRewardSortValue = {
    /** Best referrer reward in EUR (0 when none). */
    rewardValue: number;
    /** Soonest future expiry (ms epoch), or null when open-ended. */
    soonestExpiry: number | null;
};

export function computeRewardSortValue(
    rewards: MerchantReward[],
    now: Date = new Date()
): MerchantRewardSortValue {
    const nowMs = now.getTime();
    let rewardValue = 0;
    let soonestExpiry: number | null = null;

    for (const reward of rewards) {
        if (reward.referrer) {
            // Fixed EUR value only: a percentage-only reward scores 0.
            rewardValue = Math.max(
                rewardValue,
                getRewardValue(reward.referrer, "eurAmount")
            );
        }
        if (reward.expiresAt) {
            const expiryMs = new Date(reward.expiresAt).getTime();
            if (
                expiryMs > nowMs &&
                (soonestExpiry === null || expiryMs < soonestExpiry)
            ) {
                soonestExpiry = expiryMs;
            }
        }
    }

    return { rewardValue, soonestExpiry };
}
