import { describe, expect, test } from "vitest";
import {
    approximately,
    planProgressKey,
    planStepLabelKey,
    planStepViews,
} from "./rewardPlan";
import { makePlan, makeStep } from "./rewardPlan.fixtures";

const NOW = 1_700_000_000_000;
const DAY = 86_400_000;

describe("approximately", () => {
    test("puts a ≈ in front of an estimated amount", () => {
        expect(approximately("+\u20ac5.00", true)).toBe(
            "\u2248\u00a0+\u20ac5.00"
        );
    });

    test("leaves an exact amount untouched", () => {
        expect(approximately("+\u20ac5.00", false)).toBe("+\u20ac5.00");
    });
});

describe("planStepViews", () => {
    test("orders the steps by their number", () => {
        const plan = makePlan([makeStep(3), makeStep(1), makeStep(2)]);

        expect(
            planStepViews(plan, "referrer", NOW).map(({ step }) => step)
        ).toEqual([1, 2, 3]);
    });

    test("dates a paid step by its settlement", () => {
        const [view] = planStepViews(
            makePlan([makeStep(1, { status: "paid", settledAt: NOW - DAY })]),
            "referrer",
            NOW
        );

        expect(view).toMatchObject({
            labelKey: "reward.plan.step.paidOn",
            date: NOW - DAY,
        });
    });

    test("calls a paid step without a settlement date paid, with no date", () => {
        const [view] = planStepViews(
            makePlan([makeStep(1, { status: "paid" })]),
            "referrer",
            NOW
        );

        expect(view).toMatchObject({ labelKey: "reward.plan.step.paid" });
        expect(view?.date).toBeUndefined();
    });

    test("dates an unlocking step by its availability while it is ahead", () => {
        const [view] = planStepViews(
            makePlan([
                makeStep(2, { status: "unlocking", availableAt: NOW + DAY }),
            ]),
            "referrer",
            NOW
        );

        expect(view).toMatchObject({
            labelKey: "reward.plan.step.unlockingOn",
            date: NOW + DAY,
        });
    });

    test.each([
        { case: "no date", availableAt: undefined },
        { case: "a date already behind", availableAt: NOW - DAY },
    ])(
        "says an unlocking step with $case is unlocking soon",
        ({ availableAt }) => {
            const [view] = planStepViews(
                makePlan([makeStep(2, { status: "unlocking", availableAt })]),
                "referrer",
                NOW
            );

            expect(view).toMatchObject({
                labelKey: "reward.plan.step.unlockingSoon",
            });
            expect(view?.date).toBeUndefined();
        }
    );

    test("words an upcoming step for the referrer around the next renewal", () => {
        const [view] = planStepViews(makePlan([makeStep(3)]), "referrer", NOW);

        expect(view?.labelKey).toBe("reward.plan.step.upcoming");
    });

    test("words an upcoming step for the referee around their own renewal", () => {
        const [view] = planStepViews(makePlan([makeStep(3)]), "referee", NOW);

        expect(view?.labelKey).toBe("reward.plan.step.upcomingReferee");
    });

    test("calls an expired step plainly expired", () => {
        const [view] = planStepViews(
            makePlan([makeStep(4, { status: "expired" })]),
            "referrer",
            NOW
        );

        expect(view?.labelKey).toBe("reward.plan.step.expired");
    });

    test("carries the estimated flag and the euro amount of each step", () => {
        const [view] = planStepViews(
            makePlan([
                makeStep(2, {
                    estimated: true,
                    amount: {
                        amount: 7,
                        eurAmount: 6.5,
                        usdAmount: 7,
                        gbpAmount: 5.5,
                    },
                }),
            ]),
            "referrer",
            NOW
        );

        expect(view).toMatchObject({ estimated: true, eurAmount: 6.5 });
    });

    test.each(["referrer", "referee"] as const)(
        "never routes a %s step to a cancellation label",
        (role) => {
            const plan = makePlan(
                (["paid", "unlocking", "upcoming", "expired"] as const).map(
                    (status, index) => makeStep(index + 1, { status })
                )
            );

            const keys = planStepViews(plan, role, NOW).map(
                ({ labelKey }) => labelKey
            );

            expect(keys.filter((key) => /cancel/i.test(key))).toEqual([]);
        }
    );
});

describe("a plan without a progression", () => {
    const plan = makePlan([makeStep(2)], { stepBy: undefined });

    test("counts payments, like a cycle plan", () => {
        expect(planProgressKey(plan)).toBe("reward.plan.progress");
        expect(planStepLabelKey(plan)).toBe("reward.plan.step.label");
    });

    test("waits for the next renewal on an upcoming step", () => {
        const [view] = planStepViews(plan, "referrer", NOW);

        expect(view?.labelKey).toBe("reward.plan.step.upcoming");
    });
});

describe("plan progressions", () => {
    test("counts payments on a cycle plan and rewards on the others", () => {
        expect(planProgressKey({ stepBy: "cycle" })).toBe(
            "reward.plan.progress"
        );
        expect(planProgressKey({ stepBy: "amount" })).toBe(
            "reward.plan.progressSteps"
        );
        expect(planStepLabelKey({ stepBy: "duration" })).toBe(
            "reward.plan.step.labelReward"
        );
    });

    test.each([
        ["referrer", "reward.plan.step.upcomingAmount"],
        ["referee", "reward.plan.step.upcomingAmountReferee"],
    ] as const)(
        "says an upcoming amount step comes with the subscription, to the %s",
        (role, labelKey) => {
            const [view] = planStepViews(
                makePlan([makeStep(2)], { stepBy: "amount" }),
                role,
                NOW
            );

            expect(view?.labelKey).toBe(labelKey);
        }
    );

    test("tells how many days of subscription a duration step waits for", () => {
        const views = planStepViews(
            makePlan([makeStep(2), makeStep(4)], {
                stepBy: "duration",
                stepDays: 30,
            }),
            "referrer",
            NOW
        );

        expect(views.map(({ labelKey, days }) => [labelKey, days])).toEqual([
            ["reward.plan.step.upcomingDuration", 30],
            ["reward.plan.step.upcomingDuration", 90],
        ]);
    });
});
