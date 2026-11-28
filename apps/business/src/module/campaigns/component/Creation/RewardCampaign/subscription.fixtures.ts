import type { SubscriptionPeriod } from "./subscription";
import { DEFAULT_REWARD_FORM, type RewardFormValues } from "./utils";

type PeriodValues = SubscriptionPeriod["amount"];

const EMPTY_VALUES: PeriodValues = {
    cpa: "",
    ambassador: "",
    referee: "",
};

/** A period's CPA and split; a zero side stays blank like an untouched field. */
export const values = (
    cpa: number,
    ambassador: number,
    referee: number
): PeriodValues => ({
    cpa,
    ambassador: ambassador || "",
    referee: referee || "",
});

export const fixedPeriod = (
    to: number | "",
    own: PeriodValues = EMPTY_VALUES
): SubscriptionPeriod => ({ to, amount: own, percent: EMPTY_VALUES });

export const percentPeriod = (
    to: number | "",
    own: PeriodValues = EMPTY_VALUES
): SubscriptionPeriod => ({ to, amount: EMPTY_VALUES, percent: own });

export const subscriptionPlan = (
    overrides: Partial<RewardFormValues>
): RewardFormValues => ({
    ...DEFAULT_REWARD_FORM,
    subscription: true,
    model: "fixed",
    ...overrides,
});
