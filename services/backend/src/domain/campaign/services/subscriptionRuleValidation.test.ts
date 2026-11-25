import { describe, expect, it } from "vitest";
import type { CampaignRuleDefinition, RewardDefinition } from "../types";
import { validateSubscriptionRule } from "./subscriptionRuleValidation";

const fixed = (
    recipient: "referrer" | "referee",
    cycles?: { from: number; to: number }
): RewardDefinition => ({
    recipient,
    type: "token",
    amountType: "fixed",
    amount: 5,
    cycles,
});

const tiered = (cycles: { from: number; to: number }): RewardDefinition => ({
    recipient: "referrer",
    type: "token",
    amountType: "tiered",
    tierField: "purchase.amount",
    tiers: [{ minValue: 0, amount: 2 }],
    cycles,
});

const rule = (
    rewards: RewardDefinition[],
    over: Partial<CampaignRuleDefinition> = {}
): CampaignRuleDefinition => ({
    trigger: "purchase",
    conditions: [],
    rewards,
    subscription: {},
    ...over,
});

describe("validateSubscriptionRule", () => {
    it("accepts the first payment and renewals of each side", () => {
        expect(
            validateSubscriptionRule(
                rule([
                    fixed("referrer", { from: 1, to: 1 }),
                    fixed("referrer", { from: 2, to: 5 }),
                    fixed("referee", { from: 1, to: 24 }),
                ])
            )
        ).toBeNull();
    });

    it("rejects a recipient that is not paid from step 1", () => {
        expect(
            validateSubscriptionRule(
                rule([
                    fixed("referee", { from: 1, to: 3 }),
                    fixed("referrer", { from: 2, to: 4 }),
                ])
            )
        ).toBe(
            "Every recipient of a subscription campaign must be paid from step 1"
        );
    });

    it("allows a gap between the ranges of a recipient paid from step 1", () => {
        expect(
            validateSubscriptionRule(
                rule([
                    fixed("referrer", { from: 1, to: 1 }),
                    fixed("referrer", { from: 4, to: 6 }),
                ])
            )
        ).toBeNull();
    });

    it("requires a range on every reward of a subscription campaign", () => {
        expect(validateSubscriptionRule(rule([fixed("referrer")]))).toContain(
            "needs a cycle range"
        );
    });

    it.each([
        { from: 0, to: 1 },
        { from: 3, to: 2 },
        { from: 1, to: 25 },
        { from: 1.5, to: 2 },
    ])("rejects the range $from to $to", (cycles) => {
        expect(
            validateSubscriptionRule(rule([fixed("referrer", cycles)]))
        ).toContain("Cycle range");
    });

    it("rejects overlapping ranges of one recipient only", () => {
        expect(
            validateSubscriptionRule(
                rule([
                    fixed("referrer", { from: 1, to: 3 }),
                    fixed("referrer", { from: 3, to: 5 }),
                ])
            )
        ).toContain("must not overlap");
        expect(
            validateSubscriptionRule(
                rule([
                    fixed("referrer", { from: 1, to: 3 }),
                    fixed("referee", { from: 1, to: 3 }),
                ])
            )
        ).toBeNull();
    });

    it("forbids referral chaining", () => {
        expect(
            validateSubscriptionRule(
                rule([
                    {
                        ...fixed("referrer", { from: 1, to: 2 }),
                        chaining: { deperditionPerLevel: 50 },
                    },
                ])
            )
        ).toContain("chaining");
    });

    it("forbids a basis a renewal does not have", () => {
        expect(
            validateSubscriptionRule(
                rule([
                    {
                        recipient: "referee",
                        type: "token",
                        amountType: "percentage",
                        percent: 5,
                        percentOf: "matched_items_amount",
                        cycles: { from: 1, to: 2 },
                    },
                ])
            )
        ).toContain("percentage of the cycle payment");
    });

    it.each([
        { stepBy: "cycle" as const },
        { stepBy: "amount" as const, stepAmount: 30 },
        { stepBy: "duration" as const, stepDays: 30 },
    ])("rejects a tiered reward on a $stepBy plan", (subscription) => {
        expect(
            validateSubscriptionRule(
                rule([tiered({ from: 1, to: 1 })], { subscription })
            )
        ).toBe("Subscription campaigns pay fixed or percentage rewards");
    });

    it("only allows subscriptions on the purchase trigger", () => {
        expect(
            validateSubscriptionRule(
                rule([fixed("referrer", { from: 1, to: 1 })], {
                    trigger: "referral",
                })
            )
        ).toContain("purchase trigger");
    });

    it("forbids ranges on a regular campaign", () => {
        expect(
            validateSubscriptionRule(
                rule([fixed("referrer", { from: 1, to: 1 })], {
                    subscription: undefined,
                })
            )
        ).toContain("only valid on a subscription campaign");
    });

    it("leaves a regular campaign without ranges alone", () => {
        expect(
            validateSubscriptionRule(
                rule([fixed("referrer")], { subscription: undefined })
            )
        ).toBeNull();
    });
});

describe("validateSubscriptionRule: step modes", () => {
    const percent = (cycles: {
        from: number;
        to: number;
    }): RewardDefinition => ({
        recipient: "referrer",
        type: "token",
        amountType: "percentage",
        percent: 10,
        percentOf: "purchase_amount",
        cycles,
    });

    it("accepts an amount plan paying a percentage of each step", () => {
        expect(
            validateSubscriptionRule(
                rule([percent({ from: 1, to: 5 })], {
                    subscription: { stepBy: "amount", stepAmount: 30 },
                })
            )
        ).toBeNull();
    });

    it.each([undefined, 0, -5, Number.POSITIVE_INFINITY])(
        "requires a positive step amount (%s)",
        (stepAmount) => {
            expect(
                validateSubscriptionRule(
                    rule([fixed("referrer", { from: 1, to: 2 })], {
                        subscription: { stepBy: "amount", stepAmount },
                    })
                )
            ).toContain("positive stepAmount");
        }
    );

    it("accepts a duration plan with fixed steps and any first payment", () => {
        expect(
            validateSubscriptionRule(
                rule(
                    [
                        percent({ from: 1, to: 1 }),
                        fixed("referrer", { from: 2, to: 12 }),
                    ],
                    { subscription: { stepBy: "duration", stepDays: 30 } }
                )
            )
        ).toBeNull();
    });

    it("pays duration steps in fixed amounts only", () => {
        expect(
            validateSubscriptionRule(
                rule([percent({ from: 1, to: 3 })], {
                    subscription: { stepBy: "duration", stepDays: 30 },
                })
            )
        ).toContain("Duration steps only pay a fixed amount");
    });

    it.each([undefined, 0, 366, 1.5])(
        "requires step days between 1 and 365 (%s)",
        (stepDays) => {
            expect(
                validateSubscriptionRule(
                    rule([fixed("referrer", { from: 1, to: 2 })], {
                        subscription: { stepBy: "duration", stepDays },
                    })
                )
            ).toContain("stepDays between 1 and 365");
        }
    );

    it("refuses a step size that belongs to another mode", () => {
        const rewards = [fixed("referrer", { from: 1, to: 2 })];
        expect(
            validateSubscriptionRule(
                rule(rewards, { subscription: { stepAmount: 30 } })
            )
        ).toContain("Cycle steps");
        expect(
            validateSubscriptionRule(
                rule(rewards, {
                    subscription: {
                        stepBy: "amount",
                        stepAmount: 30,
                        stepDays: 30,
                    },
                })
            )
        ).toContain("do not take stepDays");
        expect(
            validateSubscriptionRule(
                rule(rewards, {
                    subscription: {
                        stepBy: "duration",
                        stepDays: 30,
                        stepAmount: 30,
                    },
                })
            )
        ).toContain("do not take stepAmount");
    });
});
