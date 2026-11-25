import { roundTo } from "@frak-labs/app-essentials";
import { SUBSCRIPTION_PLAN } from "@frak-labs/app-essentials/constants/rewards";
import type { TFunction } from "i18next";
import type { Hex } from "viem";
import type {
    CampaignRuleDefinition,
    RewardDefinition,
} from "@/types/Campaign";
import { REWARDS_SHARE, splitMatchesPool, splitTargetCpa } from "./cpa";
import type { RewardFormValues, RewardModel } from "./utils";

export const DEFAULT_INACTIVITY_DAYS =
    SUBSCRIPTION_PLAN.DEFAULT_INACTIVITY_DAYS;
export const MAX_INACTIVITY_DAYS = SUBSCRIPTION_PLAN.MAX_INACTIVITY_DAYS;
export const DEFAULT_STEP_DAYS = 30;
export const MAX_STEP_DAYS = SUBSCRIPTION_PLAN.MAX_STEP_DAYS;
export const MAX_PLAN_STEPS = SUBSCRIPTION_PLAN.MAX_STEPS;
const MAX_PERCENT_CPA = 100;

/** What unlocks each reward after the first payment. */
export type StepBy = NonNullable<
    NonNullable<CampaignRuleDefinition["subscription"]>["stepBy"]
>;
export const STEP_BY: readonly StepBy[] = ["cycle", "amount", "duration"];

/** Duration steps only pay a fixed amount; no progression takes tiers. */
export function allowedModels(stepBy: StepBy): readonly RewardModel[] {
    return stepBy === "duration" ? ["fixed"] : ["fixed", "percentage"];
}

/** A period's Target CPA and its split, in one unit. `""` shows the placeholder. */
type PeriodValues = {
    cpa: number | "";
    ambassador: number | "";
    referee: number | "";
};

/** A run of plan steps sharing one reward; it starts where the previous one ends. */
export type SubscriptionPeriod = {
    /** Last plan step of the period; the last period's ends the plan. */
    to: number | "";
    amount: PeriodValues;
    percent: PeriodValues;
};

const emptyValues = (): PeriodValues => ({
    cpa: "",
    ambassador: "",
    referee: "",
});

export const emptyPeriod = (): SubscriptionPeriod => ({
    to: "",
    amount: emptyValues(),
    percent: emptyValues(),
});

/** The step after a period's end; `""` while that end is unset. */
export function stepAfter(previousTo: number | "" | undefined): number | "" {
    return previousTo === "" || previousTo === undefined
        ? ""
        : Number(previousTo) + 1;
}

/** First step of a period: 1, then the step after the previous period's end. */
export function periodStart(
    periods: readonly SubscriptionPeriod[],
    index: number
): number | "" {
    return index === 0 ? 1 : stepAfter(periods[index - 1]?.to);
}

export function periodUnit(model: RewardModel | ""): "amount" | "percent" {
    return model === "percentage" ? "percent" : "amount";
}

export function periodValues(
    period: SubscriptionPeriod,
    model: RewardModel | ""
): PeriodValues {
    return model === "percentage" ? period.percent : period.amount;
}

type Recipient = RewardDefinition["recipient"];
type StepRange = { from: number; to: number };
const RECIPIENTS: readonly Recipient[] = ["referrer", "referee"];

/** A period's step range, once its bounds are set and in order. */
function periodRange(
    periods: readonly SubscriptionPeriod[],
    index: number
): StepRange | undefined {
    const from = periodStart(periods, index);
    const to = Number(periods[index]?.to);
    if (from === "" || periods[index]?.to === "") return undefined;
    return Number.isInteger(to) && to >= from ? { from, to } : undefined;
}

const recipientValue = (values: PeriodValues, recipient: Recipient) =>
    Number(recipient === "referrer" ? values.ambassador : values.referee) || 0;

function rangedDefinition(
    model: "fixed" | "percentage",
    recipient: Recipient,
    value: number,
    cycles: StepRange,
    token: { token?: Hex }
): RewardDefinition {
    return model === "percentage"
        ? {
              recipient,
              type: "token",
              amountType: "percentage",
              percent: value,
              percentOf: "purchase_amount",
              cycles,
              ...token,
          }
        : {
              recipient,
              type: "token",
              amountType: "fixed",
              amount: value,
              cycles,
              ...token,
          };
}

/** One ranged definition per period and paid side; a zero value pays nothing. */
export function periodRewards(
    values: RewardFormValues,
    token: { token?: Hex }
): RewardDefinition[] {
    const { model } = values;
    if (model !== "fixed" && model !== "percentage") return [];
    return values.periods.flatMap((period, index) => {
        const cycles = periodRange(values.periods, index);
        if (!cycles) return [];
        const own = periodValues(period, model);
        return RECIPIENTS.flatMap((recipient) => {
            const value = recipientValue(own, recipient);
            return value > 0
                ? [rangedDefinition(model, recipient, value, cycles, token)]
                : [];
        });
    });
}

/** What the form can express: a ranged fixed reward, or a basket share without bounds. */
function isEditable(def: RewardDefinition): boolean {
    const cycles = def.cycles;
    if (!cycles || def.chaining) return false;
    if (!Number.isInteger(cycles.from) || !Number.isInteger(cycles.to)) {
        return false;
    }
    if (cycles.from < 1 || cycles.to < cycles.from) return false;
    if (cycles.to > MAX_PLAN_STEPS) return false;
    if (def.amountType === "fixed") return true;
    return (
        def.amountType === "percentage" &&
        def.percentOf === "purchase_amount" &&
        def.minAmount === undefined &&
        def.maxAmount === undefined
    );
}

function overlaps(rewards: RewardDefinition[]): boolean {
    return RECIPIENTS.some((recipient) => {
        const ranges = rewards
            .filter((def) => def.recipient === recipient)
            .map((def) => def.cycles ?? { from: 0, to: 0 });
        return ranges.some((a, i) =>
            ranges.some((b, j) => j > i && a.from <= b.to && b.from <= a.to)
        );
    });
}

function valueAt(
    rewards: RewardDefinition[],
    recipient: Recipient,
    step: number
): number {
    const def = rewards.find(
        (reward) =>
            reward.recipient === recipient &&
            reward.cycles !== undefined &&
            reward.cycles.from <= step &&
            step <= reward.cycles.to
    );
    if (def?.amountType === "fixed") return def.amount;
    return def?.amountType === "percentage" ? def.percent : 0;
}

/** Every step where a definition starts or the one before it ends. */
function periodStarts(rewards: RewardDefinition[], last: number): number[] {
    const starts = new Set([1]);
    for (const { cycles } of rewards) {
        if (!cycles) continue;
        starts.add(cycles.from);
        if (cycles.to < last) starts.add(cycles.to + 1);
    }
    return [...starts].sort((a, b) => a - b);
}

type PlanReading = {
    model: "fixed" | "percentage" | "";
    periods: SubscriptionPeriod[];
};

/**
 * Read stored ranged rewards back as periods, cut wherever either side's
 * reward changes. `undefined` means the form can't express them (tiers, a
 * mixed model, overlaps, bounds), so the step must leave them untouched.
 */
export function readPlan(rewards: RewardDefinition[]): PlanReading | undefined {
    if (rewards.length === 0) return { model: "", periods: [emptyPeriod()] };
    if (!rewards.every(isEditable) || overlaps(rewards)) return undefined;
    if (new Set(rewards.map((def) => def.amountType)).size > 1) {
        return undefined;
    }
    const model =
        rewards[0]?.amountType === "percentage" ? "percentage" : "fixed";
    const last = Math.max(...rewards.map((def) => def.cycles?.to ?? 0));
    const starts = periodStarts(rewards, last);
    const periods = starts.map((from, i): SubscriptionPeriod => {
        const ambassador = valueAt(rewards, "referrer", from);
        const referee = valueAt(rewards, "referee", from);
        const pool = ambassador + referee;
        const filled: PeriodValues = {
            cpa: pool > 0 ? roundTo(pool / REWARDS_SHARE) : "",
            ambassador: ambassador || "",
            referee: referee || "",
        };
        return {
            to: (starts[i + 1] ?? last + 1) - 1,
            amount: model === "fixed" ? filled : emptyValues(),
            percent: model === "percentage" ? filled : emptyValues(),
        };
    });
    return { model, periods };
}

/** Why the periods can't be saved yet, in display order. */
export type PeriodIssue =
    | "range"
    | "bounds"
    | "split"
    | "edgeEmpty"
    | "firstMissing";

/** A negative value, or a percentage Target CPA above 100: no split can fix it. */
function outOfBounds(values: PeriodValues, isPercent: boolean): boolean {
    const cpa = Number(values.cpa) || 0;
    const ambassador = Number(values.ambassador) || 0;
    const referee = Number(values.referee) || 0;
    return (
        cpa < 0 ||
        ambassador < 0 ||
        referee < 0 ||
        (isPercent && cpa > MAX_PERCENT_CPA)
    );
}

function splitIssue(values: PeriodValues): boolean {
    const cpa = Number(values.cpa) || 0;
    const ambassador = Number(values.ambassador) || 0;
    const referee = Number(values.referee) || 0;
    if (cpa === 0) return ambassador + referee > 0;
    return !splitMatchesPool(cpa, ambassador, referee);
}

function rangeIssue(periods: readonly SubscriptionPeriod[]): boolean {
    const last = Number(periods.at(-1)?.to);
    return (
        periods.some((_, i) => !periodRange(periods, i)) ||
        last > MAX_PLAN_STEPS
    );
}

/**
 * The periods chain from step 1 to at most `MAX_PLAN_STEPS`, every split fills
 * its pool, and the first and last periods pay. A plan opens on its step 1
 * rows, so whoever the plan pays must be paid on the first period.
 */
export function periodIssues(
    values: Pick<RewardFormValues, "periods" | "model">
): PeriodIssue[] {
    const { periods, model } = values;
    if (periods.length === 0) return ["range"];
    const own = periods.map((period) => periodValues(period, model));
    const issues: PeriodIssue[] = [];
    if (rangeIssue(periods)) issues.push("range");
    if (own.some((v) => outOfBounds(v, model === "percentage"))) {
        issues.push("bounds");
    } else if (own.some(splitIssue)) {
        issues.push("split");
    }
    const pays = (v?: PeriodValues) => (Number(v?.cpa) || 0) > 0;
    if (!(pays(own[0]) && pays(own.at(-1)))) issues.push("edgeEmpty");
    const first = own[0];
    const missing = RECIPIENTS.some(
        (recipient) =>
            first !== undefined &&
            recipientValue(first, recipient) === 0 &&
            own.some((v) => recipientValue(v, recipient) > 0)
    );
    if (missing) issues.push("firstMissing");
    return issues;
}

export type VisibleIssue = Exclude<PeriodIssue, "split">;

/** Issues worth showing yet: none on an untouched plan, and a split flags itself inline. */
export function visibleIssues(
    values: Pick<RewardFormValues, "periods" | "model">
): VisibleIssue[] {
    const { periods, model } = values;
    const hasEnd = periods.some((period) => period.to !== "");
    const hasReward = periods.some(
        (period) => Number(periodValues(period, model).cpa) > 0
    );
    return periodIssues(values).filter(
        (issue): issue is VisibleIssue =>
            (issue === "range" && (hasEnd || hasReward)) ||
            issue === "bounds" ||
            (issue === "edgeEmpty" && hasReward && periods.length > 1) ||
            issue === "firstMissing"
    );
}

type Parts = { amount: number; percent: number };

type PlanValues = Pick<
    RewardFormValues,
    "periods" | "model" | "stepBy" | "stepAmount"
>;

type PlanTotals = {
    referrer: Parts;
    referee: Parts;
    commission: Parts;
    cpa: Parts;
};

const noParts = (): Parts => ({ amount: 0, percent: 0 });

function addParts(a: Parts, b: Parts): Parts {
    return {
        amount: roundTo(a.amount + b.amount),
        percent: roundTo(a.percent + b.percent),
    };
}

/**
 * What one value pays over a range. An amount plan's percentage pays a share
 * of each later step's amount, which is money; step 1 stays a share.
 */
function rangeParts(
    values: Pick<RewardFormValues, "model" | "stepBy" | "stepAmount">,
    value: number,
    range: StepRange
): Parts {
    const steps = range.to - range.from + 1;
    if (values.model !== "percentage") {
        return { amount: steps * value, percent: 0 };
    }
    if (values.stepBy !== "amount")
        return { amount: 0, percent: steps * value };
    const first = range.from === 1 ? 1 : 0;
    const stepAmount = Number(values.stepAmount) || 0;
    return {
        amount: ((steps - first) * value * stepAmount) / 100,
        percent: first * value,
    };
}

/** Each side's plan total, Frak's commission and the CPA, over every complete period. */
function planTotals(values: PlanValues): PlanTotals {
    const totals: PlanTotals = {
        referrer: noParts(),
        referee: noParts(),
        commission: noParts(),
        cpa: noParts(),
    };
    values.periods.forEach((period, index) => {
        const range = periodRange(values.periods, index);
        if (!range) return;
        const own = periodValues(period, values.model);
        const cpa = Number(own.cpa) || 0;
        const { frakCommission } = splitTargetCpa(cpa);
        const parts = (value: number) => rangeParts(values, value, range);
        totals.referrer = addParts(
            totals.referrer,
            parts(recipientValue(own, "referrer"))
        );
        totals.referee = addParts(
            totals.referee,
            parts(recipientValue(own, "referee"))
        );
        totals.commission = addParts(totals.commission, parts(frakCommission));
        totals.cpa = addParts(totals.cpa, parts(cpa));
    });
    return totals;
}

/** Only a cycle plan prices its later steps on payments still to come. */
function isApproximatePlan(
    values: Pick<RewardFormValues, "model" | "stepBy">
): boolean {
    return values.stepBy === "cycle" && values.model === "percentage";
}

function formatParts(parts: Parts, glyph: string, approximate: boolean) {
    const pieces = [
        ...(parts.percent > 0 ? [`${parts.percent}%`] : []),
        ...(parts.amount > 0 || parts.percent === 0
            ? [`${parts.amount}${glyph}`]
            : []),
    ];
    return `${approximate ? "≈ " : ""}${pieces.join(" + ")}`;
}

export type PlanTotalLabels = Record<keyof PlanTotals, string>;

/** Plan totals as shown; a share and an amount stay side by side ("10% + 3€"). */
export function planTotalLabels(
    values: PlanValues,
    glyph: string
): PlanTotalLabels {
    const totals = planTotals(values);
    const approximate = isApproximatePlan(values);
    return {
        referrer: formatParts(totals.referrer, glyph, approximate),
        referee: formatParts(totals.referee, glyph, approximate),
        commission: formatParts(totals.commission, glyph, approximate),
        cpa: formatParts(totals.cpa, glyph, approximate),
    };
}

/** A plan step's name after the progression: "All payments", "Step 1" or "Rewards 2 to 5". */
export function periodTitle(
    t: TFunction,
    stepBy: StepBy,
    range: { from: number | ""; to: number | "" },
    isWholePlan: boolean
): string {
    const base =
        `campaigns.create.reward.subscription.periods.title.${stepBy}` as const;
    if (isWholePlan) return t(`${base}.all`);
    return range.from === range.to || range.to === ""
        ? t(`${base}.one`, { from: range.from })
        : t(`${base}.range`, { from: range.from, to: range.to });
}

/** When a plan step unlocks; `undefined` while the step size is unset. */
export function stepMoment(
    t: TFunction,
    values: Pick<RewardFormValues, "stepBy" | "stepAmount" | "stepDays">,
    step: number,
    glyph: string
): string | undefined {
    const key = "campaigns.create.reward.subscription.periods.when";
    if (step === 1) return t(`${key}.first`);
    if (values.stepBy === "cycle") {
        return t(`${key}.renewal`, { count: step - 1 });
    }
    const size =
        Number(
            values.stepBy === "amount" ? values.stepAmount : values.stepDays
        ) || 0;
    if (size <= 0) return undefined;
    return values.stepBy === "amount"
        ? t(`${key}.paid`, { amount: `${roundTo((step - 1) * size)}${glyph}` })
        : t(`${key}.day`, { count: (step - 1) * size });
}

/** What unlocks the rewards after the first payment, with its step size. */
export function progressionLabel(
    t: TFunction,
    progression: {
        stepBy?: StepBy;
        stepAmount?: number | "";
        stepDays?: number | "";
    },
    glyph: string
): string {
    const key = "campaigns.create.validation.subscription.progression";
    switch (progression.stepBy) {
        case "amount":
            return t(`${key}.amount`, {
                amount: `${Number(progression.stepAmount) || 0}${glyph}`,
            });
        case "duration":
            return t(`${key}.duration`, {
                count: Number(progression.stepDays) || 0,
            });
        default:
            return t(`${key}.cycle`);
    }
}
