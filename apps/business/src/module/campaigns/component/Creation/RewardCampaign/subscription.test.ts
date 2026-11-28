import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import {
    allowedModels,
    periodIssues,
    periodStart,
    periodTitle,
    planTotalLabels,
    progressionLabel,
    stepMoment,
    visibleIssues,
} from "./subscription";
import {
    fixedPeriod,
    percentPeriod,
    subscriptionPlan,
    values,
} from "./subscription.fixtures";
import type { RewardFormValues } from "./utils";

const t = ((key: string, options?: Record<string, unknown>) =>
    options
        ? `${key} ${JSON.stringify(options)}`
        : key) as unknown as TFunction;

const plan = subscriptionPlan;

describe("allowedModels", () => {
    it("keeps tiers out of every progression and duration to fixed amounts", () => {
        expect(allowedModels("cycle")).toEqual(["fixed", "percentage"]);
        expect(allowedModels("amount")).toEqual(["fixed", "percentage"]);
        expect(allowedModels("duration")).toEqual(["fixed"]);
    });
});

describe("periodStart", () => {
    it("starts the first period on step 1 and each next one after the previous end", () => {
        const periods = [fixedPeriod(1), fixedPeriod(4), fixedPeriod(9)];

        expect(periods.map((_, i) => periodStart(periods, i))).toEqual([
            1, 2, 5,
        ]);
    });

    it("has no start while the previous period has no end", () => {
        expect(periodStart([fixedPeriod(""), fixedPeriod(5)], 1)).toBe("");
    });
});

describe("planTotalLabels", () => {
    const amountPlan = (periods: RewardFormValues["periods"]) =>
        plan({
            model: "percentage",
            stepBy: "amount",
            stepAmount: 20,
            periods,
        });

    it("adds up a fixed plan per side, with Frak's commission and the CPA", () => {
        const labels = planTotalLabels(
            plan({
                periods: [
                    fixedPeriod(1, values(15, 10, 2)),
                    fixedPeriod(5, values(7.5, 5, 1)),
                ],
            }),
            "€"
        );

        expect(labels).toEqual({
            referrer: "30€",
            referee: "6€",
            commission: "9€",
            cpa: "45€",
        });
    });

    it("leaves out periods whose bounds aren't set yet", () => {
        const labels = planTotalLabels(
            plan({
                periods: [
                    fixedPeriod(1, values(15, 10, 2)),
                    fixedPeriod("", values(5, 4, 0)),
                ],
            }),
            "€"
        );

        expect(labels.referrer).toBe("10€");
    });

    it("marks a cycle plan's percentages as estimates", () => {
        const labels = planTotalLabels(
            plan({
                model: "percentage",
                periods: [percentPeriod(2, values(12.5, 8, 2))],
            }),
            "€"
        );

        expect(labels.referrer).toBe("≈ 16%");
    });

    it("sums a cycle plan's percentages as shares of a payment", () => {
        const labels = planTotalLabels(
            plan({
                model: "percentage",
                periods: [percentPeriod(4, values(12.5, 8, 2))],
            }),
            "€"
        );

        expect(labels.referrer).toBe("≈ 32%");
    });

    it("counts Frak's commission as shares of each payment under a percentage", () => {
        const labels = planTotalLabels(
            plan({
                model: "percentage",
                periods: [percentPeriod(4, values(12.5, 8, 2))],
            }),
            "€"
        );

        expect(labels.commission).toBe("≈ 10%");
        expect(labels.cpa).toBe("≈ 50%");
    });

    it("keeps a share and an amount side by side on an amount plan", () => {
        const labels = planTotalLabels(
            amountPlan([percentPeriod(5, values(12.5, 10, 0))]),
            "€"
        );

        expect(labels.referrer).toBe("10% + 8€");
    });

    it("prices every step of an amount plan range that starts after step 1 as money", () => {
        const labels = planTotalLabels(
            amountPlan([
                percentPeriod(1),
                percentPeriod(5, values(12.5, 10, 0)),
            ]),
            "€"
        );

        expect(labels.referrer).toBe("8€");
    });

    it("keeps a one-step first period of an amount plan as a share", () => {
        const labels = planTotalLabels(
            amountPlan([percentPeriod(1, values(12.5, 10, 0))]),
            "€"
        );

        expect(labels.referrer).toBe("10%");
    });

    it("pays nothing on later amount steps while the step amount is blank", () => {
        const labels = planTotalLabels(
            {
                ...amountPlan([
                    percentPeriod(1),
                    percentPeriod(3, values(12.5, 10, 0)),
                ]),
                stepAmount: "",
            },
            "€"
        );

        expect(labels.referrer).toBe("0€");
    });

    it("estimates a cycle plan paying a percentage", () => {
        const labels = planTotalLabels(
            plan({
                model: "percentage",
                stepBy: "cycle",
                periods: [percentPeriod(2, values(12.5, 8, 2))],
            }),
            "€"
        );

        expect(labels.cpa.startsWith("≈")).toBe(true);
    });

    it.each([
        { stepBy: "cycle", model: "fixed" },
        { stepBy: "amount", model: "percentage" },
        { stepBy: "amount", model: "fixed" },
        { stepBy: "duration", model: "fixed" },
    ] as const)("prices a $stepBy plan paying a $model exactly", (shape) => {
        const period =
            shape.model === "fixed"
                ? fixedPeriod(2, values(12.5, 8, 2))
                : percentPeriod(2, values(12.5, 8, 2));
        const labels = planTotalLabels(
            plan({ ...shape, stepAmount: 20, periods: [period] }),
            "€"
        );

        expect(labels.cpa).not.toContain("≈");
    });
});

describe("periodIssues", () => {
    const pays = values(15, 10, 2);
    const cases: [string, RewardFormValues, string[]][] = [
        [
            "nothing on a complete plan",
            plan({
                periods: [
                    fixedPeriod(1, pays),
                    fixedPeriod(5, values(7.5, 5, 1)),
                ],
            }),
            [],
        ],
        [
            "nothing on one period covering the plan up to step 24",
            plan({ periods: [fixedPeriod(24, pays)] }),
            [],
        ],
        [
            "nothing on an empty period between two paid ones",
            plan({
                periods: [
                    fixedPeriod(1, pays),
                    fixedPeriod(3),
                    fixedPeriod(6, values(7.5, 5, 1)),
                ],
            }),
            [],
        ],
        [
            "range and edgeEmpty on an untouched plan",
            plan({ periods: [fixedPeriod("")] }),
            ["range", "edgeEmpty"],
        ],
        [
            "range when a period ends before it starts",
            plan({ periods: [fixedPeriod(3, pays), fixedPeriod(2, pays)] }),
            ["range"],
        ],
        [
            "range when the plan goes past step 24",
            plan({ periods: [fixedPeriod(25, pays)] }),
            ["range"],
        ],
        [
            "bounds on a negative split",
            plan({ periods: [fixedPeriod(4, values(15, -5, 20))] }),
            ["bounds"],
        ],
        [
            "bounds on a percentage Target CPA above 100",
            plan({
                model: "percentage",
                periods: [percentPeriod(3, values(125, 80, 20))],
            }),
            ["bounds"],
        ],
        [
            "split when a split doesn't fill its pool",
            plan({ periods: [fixedPeriod(4, values(15, 5, 2))] }),
            ["split"],
        ],
        [
            "edgeEmpty and firstMissing when the first period pays nothing",
            plan({
                periods: [fixedPeriod(1), fixedPeriod(5, values(10, 6, 2))],
            }),
            ["edgeEmpty", "firstMissing"],
        ],
        [
            "edgeEmpty when the last period pays nothing",
            plan({
                periods: [fixedPeriod(1, values(10, 6, 2)), fixedPeriod(5)],
            }),
            ["edgeEmpty"],
        ],
        [
            "firstMissing when someone paid later gets nothing in the first period",
            plan({
                periods: [
                    fixedPeriod(1, values(12.5, 10, 0)),
                    fixedPeriod(5, values(7.5, 5, 1)),
                ],
            }),
            ["firstMissing"],
        ],
        [
            "every issue in display order",
            plan({
                periods: [fixedPeriod(1), fixedPeriod(25, values(15, 5, 2))],
            }),
            ["range", "split", "edgeEmpty", "firstMissing"],
        ],
    ];

    it.each(cases)("reports %s", (_, form, expected) => {
        expect(periodIssues(form)).toEqual(expected);
    });
});

describe("visibleIssues", () => {
    it("says nothing on an untouched plan", () => {
        expect(visibleIssues(plan({ periods: [fixedPeriod("")] }))).toEqual([]);
    });

    it("explains the missing last step as soon as a period has a reward", () => {
        expect(
            visibleIssues(
                plan({ periods: [fixedPeriod("", values(15, 10, 2))] })
            )
        ).toEqual(["range"]);
    });

    it("explains the range once a period ends before it starts", () => {
        expect(
            visibleIssues(plan({ periods: [fixedPeriod(5), fixedPeriod(3)] }))
        ).toContain("range");
    });

    it("explains a negative or over-100 value, which no split fixes", () => {
        expect(
            visibleIssues(
                plan({
                    model: "percentage",
                    periods: [percentPeriod(3, values(125, 80, 20))],
                })
            )
        ).toEqual(["bounds"]);
    });

    it("leaves a mismatched split to the inline warning", () => {
        expect(
            visibleIssues(plan({ periods: [fixedPeriod(4, values(15, 5, 2))] }))
        ).toEqual([]);
    });
});

describe("progressionLabel", () => {
    const key = "campaigns.create.validation.subscription.progression";

    it("names each progression with its step size in the currency glyph", () => {
        expect(progressionLabel(t, { stepBy: "cycle" }, "€")).toBe(
            `${key}.cycle`
        );
        expect(
            progressionLabel(t, { stepBy: "amount", stepAmount: 30 }, "€")
        ).toBe(`${key}.amount {"amount":"30€"}`);
        expect(
            progressionLabel(t, { stepBy: "duration", stepDays: 14 }, "€")
        ).toBe(`${key}.duration {"count":14}`);
    });
});

describe("periodTitle", () => {
    it("names a lone period after the whole plan", () => {
        expect(periodTitle(t, "duration", { from: 1, to: 6 }, true)).toBe(
            "campaigns.create.reward.subscription.periods.title.duration.all"
        );
    });

    it("names one step or a range of steps after the progression", () => {
        expect(periodTitle(t, "cycle", { from: 1, to: 1 }, false)).toBe(
            'campaigns.create.reward.subscription.periods.title.cycle.one {"from":1}'
        );
        expect(periodTitle(t, "amount", { from: 2, to: 5 }, false)).toBe(
            'campaigns.create.reward.subscription.periods.title.amount.range {"from":2,"to":5}'
        );
    });
});

describe("stepMoment", () => {
    const when = "campaigns.create.reward.subscription.periods.when";

    it("calls step 1 the first payment in every progression", () => {
        expect(stepMoment(t, plan({ stepBy: "amount" }), 1, "€")).toBe(
            `${when}.first`
        );
    });

    it("dates a later step by renewal, days or amount paid", () => {
        expect(stepMoment(t, plan({}), 4, "€")).toBe(
            `${when}.renewal {"count":3}`
        );
        expect(
            stepMoment(t, plan({ stepBy: "duration", stepDays: 30 }), 3, "€")
        ).toBe(`${when}.day {"count":60}`);
        expect(
            stepMoment(t, plan({ stepBy: "amount", stepAmount: 20 }), 3, "€")
        ).toBe(`${when}.paid {"amount":"40€"}`);
    });

    it("says nothing while the step size is unset", () => {
        expect(
            stepMoment(t, plan({ stepBy: "amount", stepAmount: "" }), 3, "€")
        ).toBeUndefined();
    });
});
