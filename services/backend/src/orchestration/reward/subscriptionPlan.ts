import {
    DEFAULT_SUBSCRIPTION_INACTIVITY_DAYS,
    type RewardDefinition,
    type SubscriptionRule,
    subscriptionStepBy,
} from "../../domain/campaign";
import type { AssetLogSelect } from "../../domain/rewards/db/schema";
import type { SubscriptionCycle } from "../../domain/rewards/repositories/InteractionLogRepository";
import { roundAmount } from "../../utils/numeric";

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** A plan step and the paid cycle that earns it. */
export type StepCycle = {
    step: number;
    cycle: SubscriptionCycle;
    /** Basis of a re-priced cycle step: what one cycle of the covering payment paid. */
    cycleAmount: number;
};

const LIVE = new Set(["pending", "processing", "bank_depleted", "settled"]);
const PAYABLE = new Set(["pending", "bank_depleted"]);

function isLive(row: AssetLogSelect): boolean {
    return LIVE.has(row.status);
}

/** Held and not released yet, still able to pay. */
export function isHeld(row: AssetLogSelect): boolean {
    return (
        row.heldAt !== null &&
        row.releasedAt === null &&
        PAYABLE.has(row.status)
    );
}

/** Released and not settled: the only released state a refund can still undo. */
export function isReleasedUnsettled(row: AssetLogSelect): boolean {
    return row.releasedAt !== null && PAYABLE.has(row.status);
}

export function inactivityDaysOf(rule: {
    subscription?: { inactivityDays?: number };
}): number {
    return (
        rule.subscription?.inactivityDays ??
        DEFAULT_SUBSCRIPTION_INACTIVITY_DAYS
    );
}

export function planLengthOf(rewards: RewardDefinition[]): number {
    return rewards.reduce(
        (max, reward) => Math.max(max, reward.cycles?.to ?? 0),
        0
    );
}

/** The definition that pays this recipient on this step. */
export function definitionFor(
    rewards: RewardDefinition[],
    recipient: string,
    step: number
): RewardDefinition | undefined {
    return rewards.find(
        (reward) =>
            reward.recipient === recipient &&
            reward.cycles !== undefined &&
            reward.cycles.from <= step &&
            step <= reward.cycles.to
    );
}

/** The counted cycles from the plan's checkout on; empty when the checkout itself is not counted. */
export function cyclesSinceAnchor(
    cycles: SubscriptionCycle[],
    anchorInteractionId: string
): SubscriptionCycle[] {
    const anchorIndex = cycles.findIndex(
        (cycle) => cycle.interactionLogId === anchorInteractionId
    );
    return anchorIndex === -1 ? [] : cycles.slice(anchorIndex);
}

const perCycle = (cycle: SubscriptionCycle) =>
    cycle.merchandiseAmount / cycle.cyclesCovered;

/** One step per cycle a payment covers: a prepaid charge covers several. */
function mapStepsToCycles(
    cycles: SubscriptionCycle[],
    anchorInteractionId: string,
    planLength: number
): StepCycle[] {
    const steps: StepCycle[] = [];
    for (const cycle of cyclesSinceAnchor(cycles, anchorInteractionId)) {
        const cycleAmount = perCycle(cycle);
        for (let i = 0; i < cycle.cyclesCovered; i++) {
            if (steps.length >= planLength) return steps;
            steps.push({ step: steps.length + 1, cycle, cycleAmount });
        }
    }
    return steps;
}

/** Step 1 is always the checkout: null when the plan's checkout is not counted or the plan is empty. */
function seedFirstStep(params: {
    cycles: SubscriptionCycle[];
    anchorInteractionId: string;
    planLength: number;
}): {
    anchor: SubscriptionCycle;
    later: SubscriptionCycle[];
    steps: StepCycle[];
} | null {
    const [anchor, ...later] = cyclesSinceAnchor(
        params.cycles,
        params.anchorInteractionId
    );
    if (!anchor || params.planLength < 1) return null;
    return {
        anchor,
        later,
        steps: [{ step: 1, cycle: anchor, cycleAmount: perCycle(anchor) }],
    };
}

/**
 * Step 1 is the checkout; step `n + 1` is earned once `n * stepAmount` was paid
 * after its first cycle (a prepaid checkout's extra cycles count). `amountOf`
 * gives a cycle's payment in the unit of `stepAmount`.
 */
function mapStepsByAmount(params: {
    cycles: SubscriptionCycle[];
    anchorInteractionId: string;
    planLength: number;
    stepAmount: number;
    amountOf: (cycle: SubscriptionCycle) => number;
}): StepCycle[] {
    const seed = seedFirstStep(params);
    if (!seed) return [];
    const { anchor, later, steps } = seed;
    // A missing step size must never read as "every step is free".
    if (!(params.stepAmount > 0)) return steps;
    let paid =
        anchor.cyclesCovered > 1
            ? (params.amountOf(anchor) * (anchor.cyclesCovered - 1)) /
              anchor.cyclesCovered
            : 0;
    const credit = (cycle: SubscriptionCycle) => {
        while (
            steps.length < params.planLength &&
            roundAmount(paid) >= roundAmount(steps.length * params.stepAmount)
        ) {
            steps.push({
                step: steps.length + 1,
                cycle,
                cycleAmount: params.stepAmount,
            });
        }
    };
    credit(anchor);
    for (const cycle of later) {
        paid += params.amountOf(cycle);
        credit(cycle);
    }
    return steps;
}

/**
 * Step 1 is the checkout; step `n + 1` is earned by the first payment made
 * once the subscriber was active `n * stepDays`. A gap between two payments
 * longer than the inactivity window is a lapse and adds no active time.
 */
function mapStepsByDuration(params: {
    cycles: SubscriptionCycle[];
    anchorInteractionId: string;
    planLength: number;
    stepDays: number;
    inactivityDays: number;
}): StepCycle[] {
    const seed = seedFirstStep(params);
    if (!seed) return [];
    const { anchor, later, steps } = seed;
    if (!(params.stepDays > 0)) return steps;
    const lapseMs = params.inactivityDays * MS_PER_DAY;
    let activeMs = 0;
    let previous = anchor;
    for (const cycle of later) {
        const gap = cycle.paidAt.getTime() - previous.paidAt.getTime();
        if (gap <= lapseMs) activeMs += gap;
        previous = cycle;
        while (
            steps.length < params.planLength &&
            activeMs >= steps.length * params.stepDays * MS_PER_DAY
        ) {
            steps.push({ step: steps.length + 1, cycle, cycleAmount: 0 });
        }
    }
    return steps;
}

/** Steps earned under the plan's `stepBy`; amount plans need their cycles in reward-token units. */
export function mapSteps(params: {
    subscription: SubscriptionRule | undefined;
    cycles: SubscriptionCycle[];
    anchorInteractionId: string;
    planLength: number;
    amountOf: (cycle: SubscriptionCycle) => number;
}): StepCycle[] {
    const { subscription, cycles, anchorInteractionId, planLength } = params;
    switch (subscriptionStepBy({ subscription })) {
        case "amount":
            return mapStepsByAmount({
                cycles,
                anchorInteractionId,
                planLength,
                stepAmount: subscription?.stepAmount ?? 0,
                amountOf: params.amountOf,
            });
        case "duration":
            return mapStepsByDuration({
                cycles,
                anchorInteractionId,
                planLength,
                stepDays: subscription?.stepDays ?? 0,
                inactivityDays: inactivityDaysOf({ subscription }),
            });
        default:
            return mapStepsToCycles(cycles, anchorInteractionId, planLength);
    }
}

export function expiryAfter(cycle: SubscriptionCycle, days: number): Date {
    return new Date(cycle.paidAt.getTime() + days * MS_PER_DAY);
}

/**
 * Steps with no live row whose held row expired before the latest paid
 * cycle: the plan was dormant, and that cycle wakes it up again.
 */
export function findRearmable(
    rows: AssetLogSelect[],
    lastCycle: SubscriptionCycle
): AssetLogSelect[] {
    const liveKeys = new Set(
        rows.filter(isLive).map((row) => `${row.recipientType}:${row.planStep}`)
    );
    const byKey = new Map<string, AssetLogSelect>();
    for (const row of rows) {
        const key = `${row.recipientType}:${row.planStep}`;
        const wasHeld = row.heldAt !== null && row.releasedAt === null;
        if (
            row.status !== "expired" ||
            !wasHeld ||
            liveKeys.has(key) ||
            !row.cancelledAt ||
            row.cancelledAt >= lastCycle.paidAt
        ) {
            continue;
        }
        const known = byKey.get(key);
        if (!known || (known.cancelledAt ?? 0) < row.cancelledAt) {
            byKey.set(key, row);
        }
    }
    return [...byKey.values()];
}
