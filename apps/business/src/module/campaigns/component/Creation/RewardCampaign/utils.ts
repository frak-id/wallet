import { roundTo } from "@frak-labs/app-essentials";
import { REWARD_LOCKUP } from "@frak-labs/app-essentials/constants/rewards";
import type { Hex } from "viem";
import {
    type CampaignDraft,
    getChaining,
    getMinPurchaseAmount,
    getReferralOnly,
    setChaining,
    setMinPurchaseAmount,
    setReferralOnly,
} from "@/stores/campaignStore";
import type {
    CampaignRuleDefinition,
    RewardDefinition,
} from "@/types/Campaign";

export type RewardModel = "fixed" | "percentage" | "tiered";
type TierUnit = "percent" | "amount";

/**
 * A recipient reward tier (Ambassador/Referee). Just the reward amount — its
 * basket range and unit come from the matching `globalCpaTiers` entry by index.
 * `""` shows the placeholder.
 */
type TierRow = {
    reward: number | "";
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
     * Tiered model. `globalCpaTiers` holds each tier's basket range, Target CPA
     * and unit (the single source of truth); the recipient arrays hold only the
     * per-tier reward amount, indexed against it. All three stay the same length.
     */
    globalCpaTiers: CpaTierRow[];
    ambassadorTiers: TierRow[];
    refereeTiers: TierRow[];
    /** Shared eligibility + lockup. `""` = left empty (saved as 0). */
    minPurchaseAmount: number | "";
    lockupDays: number | "";
};

const FRAK_COMMISSION_PERCENT = 20;
/** Share of the Target CPA that reaches users (the rest is Frak's commission). */
const REWARDS_SHARE = 1 - FRAK_COMMISSION_PERCENT / 100;
/** Frak's recommended split of the rewards pool, in favour of the Ambassador. */
const AMBASSADOR_RECO_SHARE = 0.8;
/** Tolerance for the "Ambassador + Referee = pool" validation (rounding). */
const SPLIT_EPSILON = 0.01;

const emptyTier = (): TierRow => ({ reward: "" });

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
    globalCpaTiers: [emptyCpaTier("percent")],
    ambassadorTiers: [emptyTier()],
    refereeTiers: [emptyTier()],
    minPurchaseAmount: "",
    lockupDays: "",
};

/** Split a Target CPA (EUR or %) into the rewards pool and Frak's commission. */
export function splitTargetCpa(targetCpa: number) {
    const rewardsPool = roundTo(targetCpa * REWARDS_SHARE);
    return { rewardsPool, frakCommission: roundTo(targetCpa - rewardsPool) };
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
            : roundTo(rewardsPool * AMBASSADOR_RECO_SHARE);
    const referee = roundTo(rewardsPool - ambassador);
    return { ambassador, referee };
}

/**
 * When a Target CPA changes, decide the next Ambassador/Referee split. If the
 * current amounts are still the untouched recommendation for the *previous* CPA
 * they track the new CPA (re-recommended); if the user edited them, they stay
 * put (returns `null`, leaving the split for the mismatch warning to flag).
 * Shared by the Fixed/% and Tiered reveals so every model behaves identically.
 */
export function recalcSplitOnCpaChange({
    prevCpa,
    nextCpa,
    ambassador,
    referee,
}: {
    prevCpa: number;
    nextCpa: number;
    ambassador: number;
    referee: number;
}): { ambassador: number; referee: number } | null {
    const prevReco = recommendedSplit(prevCpa);
    const isUntouchedReco =
        ambassador > 0 &&
        referee > 0 &&
        ambassador === prevReco.ambassador &&
        referee === prevReco.referee;
    return isUntouchedReco ? recommendedSplit(nextCpa) : null;
}

/**
 * Build a recipient's backend tiers by zipping its per-tier reward onto the
 * Global CPA ranges/units (the single source of truth): € tiers carry `amount`,
 * % tiers carry `percent`.
 */
function recipientTiersToBackend(cpaTiers: CpaTierRow[], rewards: TierRow[]) {
    return cpaTiers.map((tier, i) => {
        const range = {
            minValue: Number(tier.from) || 0,
            // Empty upper bound = ∞ — omit `maxValue` rather than send a 0 cap.
            ...(tier.to === "" ? {} : { maxValue: Number(tier.to) }),
        };
        const reward = Number(rewards[i]?.reward) || 0;
        return tier.unit === "percent"
            ? { ...range, percent: reward }
            : { ...range, amount: reward };
    });
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
        // Each recipient persists a tiered reward; the basket ranges/units come
        // from the shared Global CPA tiers, the amounts from the recipient.
        if (values.globalCpaTiers.length > 0) {
            rewards.push({
                recipient: "referrer",
                type: "token",
                amountType: "tiered",
                tierField: "purchase.amount",
                tiers: recipientTiersToBackend(
                    values.globalCpaTiers,
                    values.ambassadorTiers
                ),
                ...token,
            });
            rewards.push({
                recipient: "referee",
                type: "token",
                amountType: "tiered",
                tierField: "purchase.amount",
                tiers: recipientTiersToBackend(
                    values.globalCpaTiers,
                    values.refereeTiers
                ),
                ...token,
            });
        }
    }
    return rewards;
}

type BackendTier = {
    minValue: number;
    maxValue?: number;
    amount?: number;
    percent?: number;
};

const tierReward = (tier: BackendTier) =>
    tier.percent !== undefined ? tier.percent : (tier.amount ?? 0);

/**
 * Rebuild the tiered form from its two persisted reward definitions. The
 * Global CPA table isn't stored, so each tier's range/unit comes from the
 * persisted (ambassador) tiers and its CPA is re-derived from the split
 * (CPA = pool / 80%, mirroring `targetCpa`).
 */
function tieredDraftToForm(
    rule: CampaignRuleDefinition,
    referrer?: RewardDefinition,
    referee?: RewardDefinition
): RewardFormValues {
    const ambBackend: BackendTier[] =
        referrer?.amountType === "tiered" ? referrer.tiers : [];
    const refBackend: BackendTier[] =
        referee?.amountType === "tiered" ? referee.tiers : [];

    const ambassadorTiers: TierRow[] = ambBackend.map((t) => ({
        reward: tierReward(t),
    }));
    const refereeTiers: TierRow[] = refBackend.map((t) => ({
        reward: tierReward(t),
    }));
    const globalCpaTiers: CpaTierRow[] = ambBackend.map((a, i) => {
        const sum =
            tierReward(a) + (refBackend[i] ? tierReward(refBackend[i]) : 0);
        return {
            from: a.minValue,
            to: a.maxValue ?? "",
            cpa: sum > 0 ? roundTo(sum / REWARDS_SHARE) : "",
            unit: a.percent !== undefined ? "percent" : "amount",
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
    const amountPool = ambassadorAmount + refereeAmount;
    const percentPool = ambassadorPercent + refereePercent;

    return {
        ...DEFAULT_REWARD_FORM,
        referralOnly: getReferralOnly(rule),
        model,
        targetCpa: amountPool > 0 ? roundTo(amountPool / REWARDS_SHARE) : 0,
        ambassadorAmount,
        refereeAmount,
        targetCpaPercent:
            percentPool > 0 ? roundTo(percentPool / REWARDS_SHARE) : 0,
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
    // Rewards were rebuilt above; re-apply preserved chaining so editing the
    // reward step never wipes the referral-chain settings.
    rule = setChaining(rule, getChaining(draft.rule));
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
function tieredTiersValid(tiers: CpaTierRow[]): boolean {
    return (
        tiers.length > 0 &&
        tiers.every((tier, i) =>
            isCpaTierComplete(tier, i === tiers.length - 1)
        )
    );
}

/**
 * Whether any two basket ranges overlap. Touching boundaries are allowed
 * (the backend resolves them by highest `minValue`); only a genuine overlap
 * is flagged. Empty upper bound reads as ∞. The backend rejects overlaps at
 * publish, so this gates Continue too.
 */
export function tieredRangesOverlap(tiers: CpaTierRow[]): boolean {
    const ranges = tiers
        .filter((t) => t.from !== "")
        .map((t) => ({
            from: Number(t.from),
            to: t.to === "" ? Number.POSITIVE_INFINITY : Number(t.to),
        }));
    return ranges.some((a, i) =>
        ranges.some((b, j) => j > i && a.from < b.to && b.from < a.to)
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
 * Whether every tier has both recipient rewards filled in. The split is no
 * longer forced to equal 80% of the CPA — the per-tier distribution bar shows
 * the recommended split as guidance, while the amounts stay the user's. Each
 * reward must still be > 0: the backend rejects a zero/negative tier amount at
 * publish, and a tiered definition can't skip a basket range.
 */
function tieredSplitValid(values: RewardFormValues): boolean {
    const {
        globalCpaTiers: cpa,
        ambassadorTiers: amb,
        refereeTiers: ref,
    } = values;
    if (amb.length !== cpa.length || ref.length !== cpa.length) return false;
    return cpa.every(
        (_, i) => Number(amb[i].reward) > 0 && Number(ref[i].reward) > 0
    );
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
            tieredTiersValid(values.globalCpaTiers) &&
            !tieredRangesOverlap(values.globalCpaTiers) &&
            tieredSplitValid(values)
        );
    }
    // No model selected ⇒ not valid yet.
    return false;
}
