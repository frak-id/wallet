import type { CalculatedReward, CampaignTrigger } from "../../domain/campaign";
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
 * its first direct referrer share goes to the user as `welcome_bonus`; every
 * other reward computed for Frak is dropped.
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

    let bonusPaid = false;
    const result: PolicyReward[] = [];
    for (const reward of rewards) {
        if (reward.recipientIdentityGroupId !== frakIdentityGroupId) {
            result.push(reward);
            continue;
        }
        if (bonusPaid || !paysBonus || !isDirectReferrerShare(reward)) continue;

        bonusPaid = true;
        result.push({
            ...reward,
            recipient: "welcome_bonus",
            recipientIdentityGroupId: userIdentityGroupId,
        });
    }

    return result;
}

function isDirectReferrerShare(reward: CalculatedReward): boolean {
    return (
        reward.recipient === "referrer" &&
        (reward.chainDepth === undefined || reward.chainDepth === 1)
    );
}
