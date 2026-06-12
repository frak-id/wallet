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
    /**
     * Tiered model. `globalCpaTiers` is a UI aid (re-derived on load); the
     * per-recipient tiers are what persist. Split ranges/unit mirror Global.
     */
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
const AMBASSADOR_RECO_SHARE = 0.8;
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
    // Prefer a whole-number Ambassador share with the Referee taking the
    // remainder, so typical pools land on clean integers (pool 8 → 6 / 2). But
    // for small pools the rounded share can overshoot (pool 0.8 → 1), pushing
    // the Referee negative — there, fall back to a to-the-cent split.
    const whole = Math.round(rewardsPool * AMBASSADOR_RECO_SHARE);
    const ambassador =
        whole > 0 && whole < rewardsPool
            ? whole
            : round2(rewardsPool * AMBASSADOR_RECO_SHARE);
    const referee = round2(rewardsPool - ambassador);
    return { ambassador, referee };
}

/** A form tier → backend tier: € rows carry `amount`, % rows carry `percent`. */
function tierRowToBackend(row: TierRow) {
    const range = {
        minValue: Number(row.from) || 0,
        // Empty upper bound = ∞ — omit `maxValue` rather than send a 0 cap.
        ...(row.to === "" ? {} : { maxValue: Number(row.to) }),
    };
    return row.unit === "percent"
        ? { ...range, percent: Number(row.reward) || 0 }
        : { ...range, amount: Number(row.reward) || 0 };
}

/** Build the backend reward list from the form. */
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
    } else if (values.model === "tiered") {
        // The Global CPA table is a UI aid (re-derived on load); only the
        // per-recipient tiers persist, keyed on the basket amount.
        if (values.ambassadorTiers.length > 0) {
            rewards.push({
                recipient: "referrer",
                type: "token",
                amountType: "tiered",
                tierField: "purchase.amount",
                tiers: values.ambassadorTiers.map(tierRowToBackend),
                ...token,
            });
        }
        if (values.refereeTiers.length > 0) {
            rewards.push({
                recipient: "referee",
                type: "token",
                amountType: "tiered",
                tierField: "purchase.amount",
                tiers: values.refereeTiers.map(tierRowToBackend),
                ...token,
            });
        }
    }
    return rewards;
}

/** A persisted backend tier → form row (% rows carry `percent`, € rows `amount`). */
function tierToFormRow(tier: {
    minValue: number;
    maxValue?: number;
    amount?: number;
    percent?: number;
}): TierRow {
    const isPercent = tier.percent !== undefined;
    return {
        from: tier.minValue,
        to: tier.maxValue ?? "",
        reward: isPercent ? (tier.percent ?? 0) : (tier.amount ?? 0),
        unit: isPercent ? "percent" : "eur",
    };
}

/**
 * Rebuild the tiered form from its two persisted reward definitions. The
 * Global CPA table isn't stored, so it's re-derived per range from the
 * Ambassador/Referee split (CPA = pool / 80%), mirroring `targetCpa`.
 */
function tieredDraftToForm(
    rule: CampaignRuleDefinition,
    referrer?: RewardDefinition,
    referee?: RewardDefinition
): RewardFormValues {
    const ambassadorTiers =
        referrer?.amountType === "tiered"
            ? referrer.tiers.map(tierToFormRow)
            : [];
    const refereeTiers =
        referee?.amountType === "tiered"
            ? referee.tiers.map(tierToFormRow)
            : [];
    const globalCpaTiers: CpaTierRow[] = ambassadorTiers.map((a, i) => {
        const sum =
            (Number(a.reward) || 0) + (Number(refereeTiers[i]?.reward) || 0);
        return {
            from: a.from,
            to: a.to,
            cpa: sum > 0 ? round2(sum / REWARDS_SHARE) : "",
            // Global unit follows the ambassador tier; the form's mirror keeps
            // the ambassador/referee units in lock-step with it.
            unit: a.unit,
        };
    });

    return {
        ...DEFAULT_REWARD_FORM,
        referralOnly: getReferralOnly(rule),
        model: "tiered",
        globalCpaTiers: globalCpaTiers.length
            ? globalCpaTiers
            : DEFAULT_REWARD_FORM.globalCpaTiers,
        ambassadorTiers: ambassadorTiers.length
            ? ambassadorTiers
            : DEFAULT_REWARD_FORM.ambassadorTiers,
        refereeTiers: refereeTiers.length
            ? refereeTiers
            : DEFAULT_REWARD_FORM.refereeTiers,
        // Tiered eligibility comes from the ranges; the standalone min is unused.
        minPurchaseAmount: "",
        lockupDays: rule.defaultLockupSeconds
            ? Math.round(
                  rule.defaultLockupSeconds / REWARD_LOCKUP.SECONDS_PER_DAY
              )
            : "",
    };
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

    if (model === "tiered") {
        return tieredDraftToForm(rule, referrer, referee);
    }

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

/**
 * A Global-CPA tier is complete when it has a basket range and a positive CPA.
 * The last tier's upper bound may be left empty (it reads as ∞).
 */
function isCpaTierComplete(tier: CpaTierRow, isLast: boolean): boolean {
    const fromOk = tier.from !== "";
    const toOk = isLast || tier.to !== "";
    const cpaOk = Number(tier.cpa) > 0;
    return fromOk && toOk && cpaOk;
}

/** Whether every Global-CPA tier is complete (at least one tier required). */
export function tieredTiersValid(tiers: CpaTierRow[]): boolean {
    return (
        tiers.length > 0 &&
        tiers.every((tier, i) =>
            isCpaTierComplete(tier, i === tiers.length - 1)
        )
    );
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
 * Whether every tier's split is allocated like the fixed/% pool: both
 * recipients get a positive reward and Ambassador + Referee = 80% of that
 * tier's CPA. Each reward must be > 0 — the backend rejects a zero/negative
 * tier amount at publish, and a tiered definition can't skip a basket range.
 */
function tieredSplitValid(values: RewardFormValues): boolean {
    const {
        globalCpaTiers: cpa,
        ambassadorTiers: amb,
        refereeTiers: ref,
    } = values;
    if (amb.length !== cpa.length || ref.length !== cpa.length) return false;
    return cpa.every((tier, i) => {
        const ambReward = Number(amb[i].reward);
        const refReward = Number(ref[i].reward);
        if (!(ambReward > 0) || !(refReward > 0)) return false;
        return splitMatchesPool(Number(tier.cpa) || 0, ambReward, refReward);
    });
}

/**
 * Continue gating. Fixed/% require a positive Target CPA whose pool is fully
 * allocated (Ambassador + Referee + Frak commission = Target CPA). Tiered
 * applies the same rule to every tier (complete range, CPA > 0, split = 80%).
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
    if (values.model === "tiered") {
        return (
            tieredTiersValid(values.globalCpaTiers) && tieredSplitValid(values)
        );
    }
    // No model selected ⇒ not valid yet.
    return false;
}
