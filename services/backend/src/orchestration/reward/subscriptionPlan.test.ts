import { describe, expect, it } from "vitest";
import type { AssetLogSelect } from "../../domain/rewards/db/schema";
import type { SubscriptionCycle } from "../../domain/rewards/repositories/InteractionLogRepository";
import {
    definitionFor,
    findRearmable,
    isHeld,
    isReleasedUnsettled,
    mapSteps,
    planLengthOf,
} from "./subscriptionPlan";

const day = (n: number) => new Date(Date.UTC(2026, 0, 1 + n));

const cycle = (
    id: string,
    at: number,
    over: Partial<SubscriptionCycle> = {}
): SubscriptionCycle => ({
    interactionLogId: id,
    kind: "renewal",
    paidAt: day(at),
    cyclesCovered: 1,
    merchandiseAmount: 30,
    currency: "EUR",
    ...over,
});

const row = (over: Partial<AssetLogSelect>): AssetLogSelect =>
    ({
        id: "row",
        status: "pending",
        recipientType: "referee",
        planStep: 2,
        heldAt: day(0),
        releasedAt: null,
        cancelledAt: null,
        ...over,
    }) as AssetLogSelect;

const earnedBy = (steps: { step: number; cycle: SubscriptionCycle }[]) =>
    steps.map((s) => [s.step, s.cycle.interactionLogId]);

const amountOfMerchandise = (c: SubscriptionCycle) => c.merchandiseAmount;

describe("mapStepsByAmount", () => {
    const byAmount = (
        cycles: SubscriptionCycle[],
        over: { planLength?: number; stepAmount?: number } = {}
    ) =>
        mapSteps({
            subscription: {
                stepBy: "amount",
                stepAmount: over.stepAmount ?? 30,
            },
            cycles,
            anchorInteractionId: "a",
            planLength: over.planLength ?? 10,
            amountOf: amountOfMerchandise,
        });

    it("adds up small orders of several schedules until a step is paid for", () => {
        const steps = byAmount([
            cycle("a", 0, { merchandiseAmount: 10 }),
            cycle("b", 14, { merchandiseAmount: 8 }),
            cycle("c", 21, { merchandiseAmount: 22 }),
            cycle("d", 28, { merchandiseAmount: 9 }),
            cycle("e", 42, { merchandiseAmount: 25 }),
        ]);

        expect(earnedBy(steps)).toEqual([
            [1, "a"],
            [2, "c"],
            [3, "e"],
        ]);
    });

    it("never counts the first payment toward a step", () => {
        const steps = byAmount([cycle("a", 0, { merchandiseAmount: 100 })]);

        expect(earnedBy(steps)).toEqual([[1, "a"]]);
    });

    it("lets one big order earn several steps, up to the plan length", () => {
        const steps = byAmount(
            [cycle("a", 0), cycle("b", 30, { merchandiseAmount: 100 })],
            { planLength: 3 }
        );

        expect(earnedBy(steps)).toEqual([
            [1, "a"],
            [2, "b"],
            [3, "b"],
        ]);
    });

    it("counts the cycles a prepaid checkout pays beyond the first", () => {
        const steps = byAmount([
            cycle("a", 0, { cyclesCovered: 3, merchandiseAmount: 90 }),
        ]);

        expect(earnedBy(steps)).toEqual([
            [1, "a"],
            [2, "a"],
            [3, "a"],
        ]);
    });

    it("reads amounts through the conversion it is given", () => {
        const steps = mapSteps({
            subscription: { stepBy: "amount", stepAmount: 30 },
            cycles: [cycle("a", 0), cycle("b", 30, { merchandiseAmount: 20 })],
            anchorInteractionId: "a",
            planLength: 5,
            amountOf: (c) => c.merchandiseAmount * 1.5,
        });

        expect(earnedBy(steps)).toEqual([
            [1, "a"],
            [2, "b"],
        ]);
    });

    it("earns nothing past the checkout without a step amount", () => {
        const steps = byAmount([cycle("a", 0), cycle("b", 30)], {
            stepAmount: 0,
        });

        expect(earnedBy(steps)).toEqual([[1, "a"]]);
    });

    it("is empty when the checkout is not counted", () => {
        expect(byAmount([cycle("b", 30)])).toEqual([]);
    });
});

describe("mapStepsByDuration", () => {
    const byDuration = (
        cycles: SubscriptionCycle[],
        over: { planLength?: number; stepDays?: number } = {}
    ) =>
        mapSteps({
            subscription: {
                stepBy: "duration",
                stepDays: over.stepDays ?? 30,
                inactivityDays: 90,
            },
            cycles,
            anchorInteractionId: "a",
            planLength: over.planLength ?? 10,
            amountOf: amountOfMerchandise,
        });

    it("unlocks a month with the first payment made after it", () => {
        const steps = byDuration([
            cycle("a", 0),
            cycle("b", 42),
            cycle("c", 84),
            cycle("d", 126),
        ]);

        expect(earnedBy(steps)).toEqual([
            [1, "a"],
            [2, "b"],
            [3, "c"],
            [4, "d"],
            [5, "d"],
        ]);
    });

    it("is unmoved by how often or how much the subscriber pays", () => {
        const often = byDuration([
            cycle("a", 0),
            cycle("b", 10, { merchandiseAmount: 3 }),
            cycle("c", 20, { merchandiseAmount: 80 }),
            cycle("d", 31, { merchandiseAmount: 5 }),
        ]);

        expect(earnedBy(often)).toEqual([
            [1, "a"],
            [2, "d"],
        ]);
    });

    it("adds no active time across a lapse longer than the inactivity window", () => {
        const steps = byDuration([
            cycle("a", 0),
            cycle("b", 28),
            cycle("c", 228),
            cycle("d", 260),
        ]);

        expect(earnedBy(steps)).toEqual([
            [1, "a"],
            [2, "d"],
            [3, "d"],
        ]);
    });

    it("never goes past the plan length", () => {
        const steps = byDuration([cycle("a", 0), cycle("b", 300)], {
            planLength: 3,
            stepDays: 7,
        });

        expect(steps).toHaveLength(1);
        expect(
            byDuration([cycle("a", 0), cycle("b", 60)], {
                planLength: 3,
                stepDays: 7,
            })
        ).toHaveLength(3);
    });
});

describe("mapSteps", () => {
    const cycles = [
        cycle("a", 0),
        cycle("b", 10, { merchandiseAmount: 40 }),
        cycle("c", 40, { merchandiseAmount: 20 }),
    ];
    const run = (
        subscription: Parameters<typeof mapSteps>[0]["subscription"]
    ) =>
        earnedBy(
            mapSteps({
                subscription,
                cycles,
                anchorInteractionId: "a",
                planLength: 10,
                amountOf: amountOfMerchandise,
            })
        );

    it("counts cycles by default", () => {
        expect(run({})).toEqual([
            [1, "a"],
            [2, "b"],
            [3, "c"],
        ]);
    });

    it("counts the amount paid", () => {
        expect(run({ stepBy: "amount", stepAmount: 30 })).toEqual([
            [1, "a"],
            [2, "b"],
            [3, "c"],
        ]);
        expect(run({ stepBy: "amount", stepAmount: 50 })).toEqual([
            [1, "a"],
            [2, "c"],
        ]);
    });

    it("counts the time subscribed", () => {
        expect(run({ stepBy: "duration", stepDays: 30 })).toEqual([
            [1, "a"],
            [2, "c"],
        ]);
    });
});

describe("mapSteps by cycle", () => {
    const mapStepsToCycles = (
        cycles: SubscriptionCycle[],
        anchorInteractionId: string,
        planLength: number
    ) =>
        mapSteps({
            subscription: undefined,
            cycles,
            anchorInteractionId,
            planLength,
            amountOf: amountOfMerchandise,
        });

    it("gives each paid cycle the next step", () => {
        const steps = mapStepsToCycles(
            [cycle("a", 0), cycle("b", 30), cycle("c", 60)],
            "a",
            5
        );

        expect(steps.map((s) => [s.step, s.cycle.interactionLogId])).toEqual([
            [1, "a"],
            [2, "b"],
            [3, "c"],
        ]);
    });

    it("never goes past the plan length", () => {
        const steps = mapStepsToCycles(
            [cycle("a", 0), cycle("b", 30), cycle("c", 60)],
            "a",
            2
        );

        expect(steps).toHaveLength(2);
    });

    it("unlocks one step per cycle a prepaid charge pays for, each on a third of it", () => {
        const steps = mapStepsToCycles(
            [cycle("a", 0, { cyclesCovered: 3, merchandiseAmount: 90 })],
            "a",
            5
        );

        expect(steps.map((s) => [s.step, s.cycleAmount])).toEqual([
            [1, 30],
            [2, 30],
            [3, 30],
        ]);
    });

    it("counts cycles from the plan's checkout on, across subscriptions", () => {
        const steps = mapStepsToCycles(
            [cycle("old", -90), cycle("a", 0), cycle("resub", 200)],
            "a",
            5
        );

        expect(steps.map((s) => s.cycle.interactionLogId)).toEqual([
            "a",
            "resub",
        ]);
    });

    it("earns nothing once the checkout itself no longer counts", () => {
        expect(mapStepsToCycles([cycle("b", 30)], "a", 5)).toEqual([]);
    });
});

describe("plan definitions", () => {
    const rewards = [
        {
            recipient: "referrer",
            type: "token",
            amountType: "fixed",
            amount: 10,
            cycles: { from: 1, to: 1 },
        },
        {
            recipient: "referrer",
            type: "token",
            amountType: "fixed",
            amount: 5,
            cycles: { from: 2, to: 5 },
        },
    ] as never;

    it("measures a plan by its last cycle", () => {
        expect(planLengthOf(rewards)).toBe(5);
    });

    it("finds the definition that pays a recipient on a step", () => {
        expect(definitionFor(rewards, "referrer", 1)).toMatchObject({
            amount: 10,
        });
        expect(definitionFor(rewards, "referrer", 4)).toMatchObject({
            amount: 5,
        });
        expect(definitionFor(rewards, "referee", 1)).toBeUndefined();
        expect(definitionFor(rewards, "referrer", 6)).toBeUndefined();
    });
});

describe("row states", () => {
    it("tells a held step from a released one", () => {
        expect(isHeld(row({}))).toBe(true);
        expect(isHeld(row({ releasedAt: day(1) }))).toBe(false);
        expect(isReleasedUnsettled(row({ releasedAt: day(1) }))).toBe(true);
        expect(
            isReleasedUnsettled(row({ releasedAt: day(1), status: "settled" }))
        ).toBe(false);
    });
});

describe("findRearmable", () => {
    const expired = (over: Partial<AssetLogSelect> = {}) =>
        row({ status: "expired", cancelledAt: day(100), ...over });

    it("wakes a step that expired before the latest paid cycle", () => {
        expect(findRearmable([expired()], cycle("c", 150))).toHaveLength(1);
    });

    it("leaves a step alone when no cycle was paid since it expired", () => {
        expect(findRearmable([expired()], cycle("c", 90))).toEqual([]);
    });

    it("skips a step that already has a live row", () => {
        expect(
            findRearmable([expired(), row({ id: "live" })], cycle("c", 150))
        ).toEqual([]);
    });

    it("never revives a step that had been released", () => {
        expect(
            findRearmable([expired({ releasedAt: day(10) })], cycle("c", 150))
        ).toEqual([]);
    });

    it("takes the latest expired row of a step", () => {
        const [rearmed] = findRearmable(
            [
                expired({ id: "first", cancelledAt: day(80) }),
                expired({ id: "second", cancelledAt: day(100) }),
            ],
            cycle("c", 150)
        );

        expect(rearmed?.id).toBe("second");
    });
});
