import type {
    CampaignGoal,
    CampaignRuleDefinition,
    CampaignTrigger,
    FixedRewardDefinition,
} from "@/types/Campaign";

export type RewardFormState = {
    cac: number;
    ratio: number;
    chainingEnabled: boolean;
    deperditionPerLevel: number;
    maxDepth: number;
    referralOnly: boolean;
    /** Days a reward stays locked before settlement. 0 disables. */
    lockupDays: number;
};

export const DEFAULT_LOCKUP_DAYS = 14;
export const MIN_LOCKUP_DAYS = 0;
export const MAX_LOCKUP_DAYS = 30;

export const DEFAULT_REWARD_STATE: RewardFormState = {
    cac: 0,
    ratio: 90,
    chainingEnabled: true,
    deperditionPerLevel: 80,
    maxDepth: 5,
    referralOnly: true,
    lockupDays: DEFAULT_LOCKUP_DAYS,
};

const FRAK_COMMISSION_PERCENT = 20;

export function calculateDistribution(cac: number, ratio: number) {
    const frakCommission =
        Math.round(cac * (FRAK_COMMISSION_PERCENT / 100) * 100) / 100;
    const distributableAmount = cac - frakCommission;

    const referrerPercent = ratio / 100;
    const refereePercent = 1 - referrerPercent;

    return {
        frakCommission,
        refereeAmount:
            Math.round(distributableAmount * refereePercent * 100) / 100,
        referrerAmount:
            Math.round(distributableAmount * referrerPercent * 100) / 100,
    };
}

export function calculateChainDistribution(
    referrerAmount: number,
    deperditionPerLevel: number,
    maxDepth: number
): { level: number; amount: number; percentage: number }[] {
    if (referrerAmount <= 0 || maxDepth <= 0) {
        return [];
    }

    const distribution: {
        level: number;
        amount: number;
        percentage: number;
    }[] = [];
    let remaining = referrerAmount;
    const decayFactor = deperditionPerLevel / 100;

    for (let level = 1; level <= maxDepth; level++) {
        const isLast = level === maxDepth;
        const amount = isLast
            ? Math.round(remaining * 100) / 100
            : Math.round(remaining * decayFactor * 100) / 100;

        if (!isLast) {
            remaining -= amount;
        }

        if (amount > 0) {
            distribution.push({
                level,
                amount,
                percentage:
                    Math.round((amount / referrerAmount) * 100 * 10) / 10,
            });
        }
    }

    return distribution;
}

export function buildRewardsFromFormState(
    state: RewardFormState
): FixedRewardDefinition[] {
    const { refereeAmount, referrerAmount } = calculateDistribution(
        state.cac,
        state.ratio
    );

    const rewards: FixedRewardDefinition[] = [];

    if (refereeAmount > 0) {
        rewards.push({
            recipient: "referee",
            type: "token",
            amountType: "fixed",
            amount: refereeAmount,
        });
    }

    if (referrerAmount > 0) {
        rewards.push({
            recipient: "referrer",
            type: "token",
            amountType: "fixed",
            amount: referrerAmount,
            chaining: state.chainingEnabled
                ? {
                      deperditionPerLevel: state.deperditionPerLevel,
                      maxDepth: state.maxDepth,
                  }
                : undefined,
        });
    }

    return rewards;
}

export function updateRuleWithRewards(
    existingRule: CampaignRuleDefinition,
    rewardState: RewardFormState
): CampaignRuleDefinition {
    const rewards = buildRewardsFromFormState(rewardState);

    return {
        ...existingRule,
        rewards,
        defaultLockupDays: rewardState.lockupDays,
    };
}

export function extractFormStateFromRule(
    rule: CampaignRuleDefinition
): RewardFormState {
    const refereeReward = rule.rewards.find((r) => r.recipient === "referee");
    const referrerReward = rule.rewards.find((r) => r.recipient === "referrer");

    const refereeAmount =
        refereeReward?.amountType === "fixed" ? refereeReward.amount : 0;
    const referrerAmount =
        referrerReward?.amountType === "fixed" ? referrerReward.amount : 0;

    const distributableAmount = refereeAmount + referrerAmount;
    const cac =
        distributableAmount > 0
            ? Math.round(
                  (distributableAmount / (1 - FRAK_COMMISSION_PERCENT / 100)) *
                      100
              ) / 100
            : 0;

    const ratio =
        distributableAmount > 0
            ? Math.round((referrerAmount / distributableAmount) * 100)
            : 90;

    const chaining =
        referrerReward?.amountType === "fixed"
            ? referrerReward.chaining
            : undefined;

    const hasReferralCondition = Array.isArray(rule.conditions)
        ? rule.conditions.some(
              (c) =>
                  "field" in c &&
                  c.field === "attribution.referrerIdentityGroupId" &&
                  c.operator === "exists"
          )
        : false;

    return {
        cac,
        ratio,
        chainingEnabled: true,
        deperditionPerLevel: chaining?.deperditionPerLevel ?? 80,
        maxDepth: chaining?.maxDepth ?? 5,
        referralOnly:
            hasReferralCondition ||
            (Array.isArray(rule.conditions) && rule.conditions.length === 0),
        lockupDays: rule.defaultLockupDays ?? DEFAULT_LOCKUP_DAYS,
    };
}

/**
 * Trigger options available in the campaign creation form.
 * Each trigger is mapped to the goals it is relevant for.
 */
export type TriggerOption = {
    value: CampaignTrigger;
    label: string;
};

export const allTriggerOptions: TriggerOption[] = [
    { value: "referral", label: "Referral" },
    { value: "create_referral_link", label: "Referral Link Created" },
    { value: "purchase", label: "Purchase completed" },
    { value: "custom", label: "Custom" },
];

/**
 * Maps each campaign goal to the triggers that are relevant for it.
 *
 * - traffic: referral visits + link sharing drive traffic
 * - registration: referral arrivals + custom signup events
 * - sales: completed purchases
 * - awareness: link creation + referral visits increase visibility
 * - retention: repeat purchases + custom engagement events
 */
const triggersByGoal: Record<CampaignGoal, CampaignTrigger[]> = {
    traffic: ["referral", "create_referral_link"],
    registration: ["referral", "custom"],
    sales: ["purchase"],
    awareness: ["create_referral_link", "referral"],
    retention: ["purchase", "custom"],
};

/**
 * Returns the trigger options filtered by the selected campaign goal.
 * Falls back to all options when no goal is set.
 */
export function getTriggersForGoal(
    goal: CampaignGoal | undefined
): TriggerOption[] {
    if (!goal) return allTriggerOptions;
    const allowed = triggersByGoal[goal];
    return allTriggerOptions.filter((t) => allowed.includes(t.value));
}
