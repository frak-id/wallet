import {
    MAX_REWARD_CYCLES,
    MAX_SUBSCRIPTION_STEP_DAYS,
    subscriptionStepBy,
} from "../schemas";
import type {
    CampaignRuleDefinition,
    RewardDefinition,
    SubscriptionRule,
} from "../types";

function validateCycles(reward: RewardDefinition): string | null {
    const { cycles } = reward;
    if (!cycles) {
        return "Every reward of a subscription campaign needs a cycle range";
    }
    const { from, to } = cycles;
    if (
        !(Number.isInteger(from) && Number.isInteger(to)) ||
        from < 1 ||
        to > MAX_REWARD_CYCLES ||
        from > to
    ) {
        return `Cycle range must satisfy 1 <= from <= to <= ${MAX_REWARD_CYCLES}`;
    }
    return null;
}

// Plan steps are priced on one billing cycle: the order-level matched basis
// does not exist for a renewal.
function validateBasis(reward: RewardDefinition): string | null {
    if (reward.chaining) {
        return "Subscription campaigns do not support referral chaining";
    }
    if (
        reward.amountType === "percentage" &&
        reward.percentOf !== "purchase_amount"
    ) {
        return "Subscription campaigns can only pay a percentage of the cycle payment";
    }
    if (reward.amountType === "tiered") {
        return "Subscription campaigns pay fixed or percentage rewards";
    }
    return null;
}

/**
 * Step 1 is the checkout payment in every mode. Later steps of an amount plan
 * have a fixed basis (`stepAmount`), and a duration step has none at all.
 */
function validateLaterSteps(
    reward: RewardDefinition,
    subscription: SubscriptionRule
): string | null {
    if ((reward.cycles?.to ?? 0) < 2) return null;
    const stepBy = subscriptionStepBy({ subscription });
    if (stepBy === "duration" && reward.amountType !== "fixed") {
        return "Duration steps only pay a fixed amount";
    }
    return null;
}

function validateStepSize(subscription: SubscriptionRule): string | null {
    const { stepAmount, stepDays } = subscription;
    switch (subscriptionStepBy({ subscription })) {
        case "cycle":
            return stepAmount !== undefined || stepDays !== undefined
                ? "Cycle steps take neither stepAmount nor stepDays"
                : null;
        case "amount":
            if (stepDays !== undefined) {
                return "Amount steps do not take stepDays";
            }
            return stepAmount !== undefined &&
                Number.isFinite(stepAmount) &&
                stepAmount > 0
                ? null
                : "Amount steps need a positive stepAmount";
        case "duration":
            if (stepAmount !== undefined) {
                return "Duration steps do not take stepAmount";
            }
            return stepDays !== undefined &&
                Number.isInteger(stepDays) &&
                stepDays >= 1 &&
                stepDays <= MAX_SUBSCRIPTION_STEP_DAYS
                ? null
                : `Duration steps need stepDays between 1 and ${MAX_SUBSCRIPTION_STEP_DAYS}`;
    }
}

function validateNoOverlap(rewards: RewardDefinition[]): string | null {
    for (const recipient of ["referrer", "referee"] as const) {
        const ranges = rewards
            .filter((reward) => reward.recipient === recipient && reward.cycles)
            .map((reward) => reward.cycles)
            .sort((a, b) => (a?.from ?? 0) - (b?.from ?? 0));
        for (let i = 1; i < ranges.length; i++) {
            if ((ranges[i]?.from ?? 0) <= (ranges[i - 1]?.to ?? 0)) {
                return `Cycle ranges of the ${recipient} must not overlap`;
            }
        }
    }
    return null;
}

function validatePaidFromFirstStep(rewards: RewardDefinition[]): string | null {
    for (const recipient of ["referrer", "referee"] as const) {
        const own = rewards.filter((reward) => reward.recipient === recipient);
        if (
            own.length > 0 &&
            !own.some((reward) => reward.cycles?.from === 1)
        ) {
            return "Every recipient of a subscription campaign must be paid from step 1";
        }
    }
    return null;
}

/** Cycle ranges exist on subscription campaigns only, and there they are required. */
export function validateSubscriptionRule(
    rule: CampaignRuleDefinition
): string | null {
    const rewards = rule.rewards ?? [];
    const { subscription } = rule;

    if (!subscription) {
        return rewards.some((reward) => reward.cycles)
            ? "Cycle ranges are only valid on a subscription campaign"
            : null;
    }

    if (rule.trigger !== "purchase") {
        return "Subscriptions are only valid on the purchase trigger";
    }
    const sizeError = validateStepSize(subscription);
    if (sizeError) return sizeError;
    for (const reward of rewards) {
        const error =
            validateCycles(reward) ??
            validateBasis(reward) ??
            validateLaterSteps(reward, subscription);
        if (error) return error;
    }
    return validateNoOverlap(rewards) ?? validatePaidFromFirstStep(rewards);
}
