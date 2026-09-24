import type { CalculatedReward, CampaignTrigger } from "../../domain/campaign";
import { roundAmount } from "../../domain/campaign/services/RewardCalculator";
import type { AssetLogRecipientType } from "../../domain/rewards/schemas";

export type PolicyReward = Omit<CalculatedReward, "recipient"> & {
    recipient: AssetLogRecipientType;
};

type FrakReferralPolicyParams = {
    rewards: CalculatedReward[];
    frakIdentityGroupId: string;
    userIdentityGroupId: string;
    trigger: CampaignTrigger;
    directReferrerIsFrak: boolean;
    bonusAlreadyClaimed: boolean;
};

/**
 * Frak never keeps a reward. On the first Frak-credited purchase at a merchant,
 * its direct referrer shares go to the user as `welcome_bonus`, one row per
 * campaign; every other reward computed for Frak is dropped.
 */
export function applyFrakReferralPolicy({
    rewards,
    frakIdentityGroupId,
    userIdentityGroupId,
    trigger,
    directReferrerIsFrak,
    bonusAlreadyClaimed,
}: FrakReferralPolicyParams): PolicyReward[] {
    const paysBonus =
        trigger === "purchase" && directReferrerIsFrak && !bonusAlreadyClaimed;

    const result: PolicyReward[] = [];
    const bonusByCampaign = new Map<string, PolicyReward>();

    for (const reward of rewards) {
        if (reward.recipientIdentityGroupId !== frakIdentityGroupId) {
            result.push(reward);
            continue;
        }
        if (!paysBonus || !isDirectReferrerShare(reward)) continue;

        const merged = bonusByCampaign.get(reward.campaignRuleId);
        if (merged) {
            // A share in another token cannot join the row: dropped, budget restored.
            if (merged.token === reward.token) {
                merged.amount = roundAmount(merged.amount + reward.amount);
            }
            continue;
        }

        const bonus: PolicyReward = {
            ...reward,
            recipient: "welcome_bonus",
            recipientIdentityGroupId: userIdentityGroupId,
        };
        bonusByCampaign.set(reward.campaignRuleId, bonus);
        result.push(bonus);
    }

    return result;
}

function isDirectReferrerShare(reward: CalculatedReward): boolean {
    return (
        reward.recipient === "referrer" &&
        (reward.chainDepth === undefined || reward.chainDepth === 1)
    );
}
