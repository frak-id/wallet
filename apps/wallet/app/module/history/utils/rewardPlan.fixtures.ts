import type { RewardPlan, RewardPlanStep } from "@frak-labs/wallet-shared";

export function eur(amount: number) {
    return { amount, eurAmount: amount, usdAmount: amount, gbpAmount: amount };
}

export function makeStep(
    step: number,
    overrides: Partial<RewardPlanStep> = {}
): RewardPlanStep {
    return {
        step,
        amount: eur(1),
        estimated: false,
        status: "upcoming",
        ...overrides,
    };
}

export function makePlan(
    steps: RewardPlanStep[],
    overrides: Partial<RewardPlan> = {}
): RewardPlan {
    return {
        stepBy: "cycle",
        stepsEarned: steps.filter(
            ({ status }) => status === "paid" || status === "unlocking"
        ).length,
        stepsTotal: steps.length,
        paidAmount: eur(0),
        pendingAmount: eur(0),
        estimated: false,
        steps,
        ...overrides,
    };
}
