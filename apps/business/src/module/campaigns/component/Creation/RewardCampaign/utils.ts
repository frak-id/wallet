import { REWARD_LOCKUP } from "@frak-labs/app-essentials/constants/rewards";
import type { Hex } from "viem";
import {
    type CampaignDraft,
    getMinPurchaseAmount,
    getReferralOnly,
    setMinPurchaseAmount,
    setReferralOnly,
} from "@/stores/campaignStore";
import type {
    CampaignRuleDefinition,
    RewardDefinition,
} from "@/types/Campaign";

export type RewardModel = "fixed" | "percentage" | "tiered";
export type TierUnit = "percent" | "eur";

/** A reward tier (Ambassador/Referee table). `""` cells show their placeholder. */
export type TierRow = {
    from: number | "";
    to: number | "";
    reward: number | "";
    unit: TierUnit;
};

/** A Global-CPA tier (Tiered model). `""` cells show their placeholder. */
export type CpaTierRow = {
    from: number | "";
    to: number | "";
    cpa: number | "";
    unit: TierUnit;
};

export type RewardFormValues = {
    referralOnly: boolean;
    /** `""` until the user picks a model — no radio is selected on arrival. */
    model: RewardModel | "";
    /** Fixed model — Target CPA in EUR; pool splits into Ambassador/Referee EUR. */
    targetCpa: number;
    ambassadorAmount: number;
    refereeAmount: number;
    /** Percentage model — Target CPA as a % of basket; pool splits into %s. */
    targetCpaPercent: number;
    ambassadorPercent: number;
    refereePercent: number;
    /** Tiered model — static for now: held locally, not yet persisted. */
    globalCpaTiers: CpaTierRow[];
    ambassadorTiers: TierRow[];
    refereeTiers: TierRow[];
    /** Shared eligibility + lockup. `""` = left empty (saved as 0). */
    minPurchaseAmount: number | "";
    lockupDays: number | "";
};

export const FRAK_COMMISSION_PERCENT = 20;
/** Share of the Target CPA that reaches users (the rest is Frak's commission). */
const REWARDS_SHARE = 1 - FRAK_COMMISSION_PERCENT / 100;
/** Frak's recommended split of the rewards pool, in favour of the Ambassador. */
export const AMBASSADOR_RECO_SHARE = 0.8;
/** Tolerance for the "Ambassador + Referee = pool" validation (rounding). */
const SPLIT_EPSILON = 0.01;

const round2 = (n: number) => Math.round(n * 100) / 100;

const emptyTier = (unit: TierUnit): TierRow => ({
    from: "",
    to: "",
    reward: "",
    unit,
});

const emptyCpaTier = (unit: TierUnit): CpaTierRow => ({
    from: "",
    to: "",
    cpa: "",
    unit,
});

export const DEFAULT_REWARD_FORM: RewardFormValues = {
    referralOnly: true,
    model: "",
    targetCpa: 0,
    ambassadorAmount: 0,
    refereeAmount: 0,
    targetCpaPercent: 0,
    ambassadorPercent: 0,
    refereePercent: 0,
    globalCpaTiers: [emptyCpaTier("eur"), emptyCpaTier("eur")],
    ambassadorTiers: [emptyTier("percent"), emptyTier("percent")],
    refereeTiers: [emptyTier("eur"), emptyTier("eur")],
    minPurchaseAmount: "",
    lockupDays: "",
};

/** Split a Target CPA (EUR or %) into the rewards pool and Frak's commission. */
export function splitTargetCpa(targetCpa: number) {
    const rewardsPool = round2(targetCpa * REWARDS_SHARE);
    return { rewardsPool, frakCommission: round2(targetCpa - rewardsPool) };
}

/** Frak's recommended Ambassador/Referee values for a Target CPA (80/20 of pool). */
export function recommendedSplit(targetCpa: number) {
    const { rewardsPool } = splitTargetCpa(targetCpa);
    // Round the Ambassador share to a whole number and give the Referee the
    // remainder, so the two still sum exactly to the pool with no stray
    // decimals when the pool is whole (e.g. pool 8 → 6 / 2, not 6.4 / 1.6).
    const ambassador = Math.round(rewardsPool * AMBASSADOR_RECO_SHARE);
    const referee = round2(rewardsPool - ambassador);
    return { ambassador, referee };
}

/** Build the backend reward list from the form. Tiered is static — emits none. */
function rewardsFromForm(
    values: RewardFormValues,
    rewardToken?: Hex
): RewardDefinition[] {
    // Apply the campaign's pending currency; left off so the backend fills the
    // merchant default.
    const token = rewardToken ? { token: rewardToken } : {};
    const rewards: RewardDefinition[] = [];

    if (values.model === "fixed") {
        if (values.ambassadorAmount > 0) {
            rewards.push({
                recipient: "referrer",
                type: "token",
                amountType: "fixed",
                amount: values.ambassadorAmount,
                ...token,
            });
        }
        if (values.refereeAmount > 0) {
            rewards.push({
                recipient: "referee",
                type: "token",
                amountType: "fixed",
                amount: values.refereeAmount,
                ...token,
            });
        }
    } else if (values.model === "percentage") {
        if (values.ambassadorPercent > 0) {
            rewards.push({
                recipient: "referrer",
                type: "token",
                amountType: "percentage",
                percent: values.ambassadorPercent,
                percentOf: "purchase_amount",
                ...token,
            });
        }
        if (values.refereePercent > 0) {
            rewards.push({
                recipient: "referee",
                type: "token",
                amountType: "percentage",
                percent: values.refereePercent,
                percentOf: "purchase_amount",
                ...token,
            });
        }
    }
    // Tiered: static for now — the table is held in form state only, not yet
    // mapped to the backend (its tiers lack a unit field server-side).
    return rewards;
}

export function draftToRewardForm(draft: CampaignDraft): RewardFormValues {
    const { rule } = draft;
    const referrer = rule.rewards.find((r) => r.recipient === "referrer");
    const referee = rule.rewards.find((r) => r.recipient === "referee");
    const sample = referrer ?? referee;

    // No reward yet ⇒ leave the model unselected (matches the Figma default).
    const model: RewardModel | "" = !sample
        ? ""
        : sample.amountType === "percentage"
          ? "percentage"
          : sample.amountType === "tiered"
            ? "tiered"
            : "fixed";

    const ambassadorAmount =
        referrer?.amountType === "fixed" ? referrer.amount : 0;
    const refereeAmount = referee?.amountType === "fixed" ? referee.amount : 0;
    const ambassadorPercent =
        referrer?.amountType === "percentage" ? referrer.percent : 0;
    const refereePercent =
        referee?.amountType === "percentage" ? referee.percent : 0;
    const eurPool = ambassadorAmount + refereeAmount;
    const percentPool = ambassadorPercent + refereePercent;

    return {
        ...DEFAULT_REWARD_FORM,
        referralOnly: getReferralOnly(rule),
        model,
        targetCpa: eurPool > 0 ? round2(eurPool / REWARDS_SHARE) : 0,
        ambassadorAmount,
        refereeAmount,
        targetCpaPercent:
            percentPool > 0 ? round2(percentPool / REWARDS_SHARE) : 0,
        ambassadorPercent,
        refereePercent,
        // 0/none ⇒ leave empty so the field shows its placeholder on arrival.
        minPurchaseAmount: getMinPurchaseAmount(rule) || "",
        lockupDays: rule.defaultLockupSeconds
            ? Math.round(
                  rule.defaultLockupSeconds / REWARD_LOCKUP.SECONDS_PER_DAY
              )
            : "",
    };
}

export function rewardFormToDraft(
    values: RewardFormValues,
    draft: CampaignDraft
): CampaignDraft {
    // Empty fields ("") save as 0.
    const lockupDays = Number(values.lockupDays) || 0;
    const minPurchase =
        values.model === "tiered" ? 0 : Number(values.minPurchaseAmount) || 0;
    let rule: CampaignRuleDefinition = {
        ...draft.rule,
        rewards: rewardsFromForm(values, draft.rewardToken),
        defaultLockupSeconds: lockupDays * REWARD_LOCKUP.SECONDS_PER_DAY,
    };
    rule = setReferralOnly(rule, values.referralOnly);
    // Tiered defines its eligibility via basket ranges; clear the standalone min.
    rule = setMinPurchaseAmount(rule, minPurchase);
    return { ...draft, rule };
}

/** Whether Ambassador + Referee sum to the rewards pool (Frak's 20% aside). */
function splitMatchesPool(
    targetCpa: number,
    ambassador: number,
    referee: number
) {
    const { rewardsPool } = splitTargetCpa(targetCpa);
    return Math.abs(ambassador + referee - rewardsPool) < SPLIT_EPSILON;
}

/**
 * Continue gating. Fixed/% require a positive Target CPA whose pool is fully
 * allocated (Ambassador + Referee + Frak commission = Target CPA). Tiered is
 * static for now and never blocks Continue.
 */
export function isRewardFormValid(values: RewardFormValues): boolean {
    if (values.model === "fixed") {
        return (
            values.targetCpa > 0 &&
            splitMatchesPool(
                values.targetCpa,
                values.ambassadorAmount,
                values.refereeAmount
            )
        );
    }
    if (values.model === "percentage") {
        return (
            values.targetCpaPercent > 0 &&
            splitMatchesPool(
                values.targetCpaPercent,
                values.ambassadorPercent,
                values.refereePercent
            )
        );
    }
    // Tiered is static (never blocks); no model selected ⇒ not valid yet.
    return values.model === "tiered";
}
