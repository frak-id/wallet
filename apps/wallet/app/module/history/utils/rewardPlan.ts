import type {
    RewardHistoryItem,
    RewardPlan,
    RewardPlanStep,
} from "@frak-labs/wallet-shared";

type PlanStepLabelKey =
    | "reward.plan.step.paid"
    | "reward.plan.step.paidOn"
    | "reward.plan.step.unlockingOn"
    | "reward.plan.step.unlockingSoon"
    | "reward.plan.step.upcoming"
    | "reward.plan.step.upcomingReferee"
    | "reward.plan.step.upcomingAmount"
    | "reward.plan.step.upcomingAmountReferee"
    | "reward.plan.step.upcomingDuration"
    | "reward.plan.step.expired";

export type PlanStepView = {
    step: number;
    status: RewardPlanStep["status"];
    eurAmount: number;
    estimated: boolean;
    labelKey: PlanStepLabelKey;
    date?: number;
    /** Days of subscription a duration step waits for. */
    days?: number;
};

/** Only amount and duration plans count rewards; anything else counts cycles. */
function isCountedByReward(plan: Pick<RewardPlan, "stepBy">): boolean {
    return plan.stepBy === "amount" || plan.stepBy === "duration";
}

/** A cycle plan counts payments; the other progressions count rewards. */
export function planProgressKey(
    plan: Pick<RewardPlan, "stepBy">
): "reward.plan.progress" | "reward.plan.progressSteps" {
    return isCountedByReward(plan)
        ? "reward.plan.progressSteps"
        : "reward.plan.progress";
}

export function planStepLabelKey(
    plan: Pick<RewardPlan, "stepBy">
): "reward.plan.step.label" | "reward.plan.step.labelReward" {
    return isCountedByReward(plan)
        ? "reward.plan.step.labelReward"
        : "reward.plan.step.label";
}

/** Prefixes an amount that is still priced on the checkout payment. */
export function approximately(amount: string, estimated: boolean): string {
    return estimated ? `\u2248\u00a0${amount}` : amount;
}

/** What an upcoming step waits for, never whether the subscription stopped. */
function upcomingLabel(
    step: RewardPlanStep,
    plan: Pick<RewardPlan, "stepBy" | "stepDays">,
    role: RewardHistoryItem["role"]
): Pick<PlanStepView, "labelKey" | "days"> {
    const referee = role === "referee";
    if (plan.stepBy === "duration" && plan.stepDays) {
        return {
            labelKey: "reward.plan.step.upcomingDuration",
            days: (step.step - 1) * plan.stepDays,
        };
    }
    if (plan.stepBy === "amount") {
        return {
            labelKey: referee
                ? "reward.plan.step.upcomingAmountReferee"
                : "reward.plan.step.upcomingAmount",
        };
    }
    return {
        labelKey: referee
            ? "reward.plan.step.upcomingReferee"
            : "reward.plan.step.upcoming",
    };
}

/** Only an unlock date still ahead is worth showing; past it, the step is about to land. */
function labelFor(
    step: RewardPlanStep,
    plan: Pick<RewardPlan, "stepBy" | "stepDays">,
    role: RewardHistoryItem["role"],
    now: number
): Pick<PlanStepView, "labelKey" | "date" | "days"> {
    switch (step.status) {
        case "paid":
            return step.settledAt
                ? { labelKey: "reward.plan.step.paidOn", date: step.settledAt }
                : { labelKey: "reward.plan.step.paid" };
        case "unlocking":
            return step.availableAt && step.availableAt > now
                ? {
                      labelKey: "reward.plan.step.unlockingOn",
                      date: step.availableAt,
                  }
                : { labelKey: "reward.plan.step.unlockingSoon" };
        case "upcoming":
            return upcomingLabel(step, plan, role);
        case "expired":
            return { labelKey: "reward.plan.step.expired" };
    }
}

export function planStepViews(
    plan: RewardPlan,
    role: RewardHistoryItem["role"],
    now = Date.now()
): PlanStepView[] {
    return [...plan.steps]
        .sort((a, b) => a.step - b.step)
        .map((step) => ({
            step: step.step,
            status: step.status,
            eurAmount: step.amount.eurAmount,
            estimated: step.estimated,
            ...labelFor(step, plan, role, now),
        }));
}
