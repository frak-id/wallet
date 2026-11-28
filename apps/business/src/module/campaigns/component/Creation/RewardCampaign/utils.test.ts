import { describe, expect, it } from "vitest";
import {
    type CampaignDraft,
    getMinPurchaseAmount,
} from "@/stores/campaignStore";
import { recalcCpaFromSplit } from "./cpa";
import { fixedPeriod, percentPeriod, values } from "./subscription.fixtures";
import {
    DEFAULT_REWARD_FORM,
    draftToRewardForm,
    isRewardFormValid,
    type RewardFormValues,
    requiresMatchedBasis,
    rewardFormToDraft,
    supportsMatchedBasis,
    tieredRangeInverted,
    tieredRangesOverlap,
} from "./utils";

const baseDraft: CampaignDraft = {
    merchantId: "m1",
    name: "Test",
    rule: { trigger: "purchase", conditions: [], rewards: [] },
    metadata: { goal: undefined, specialCategories: [], territories: [] },
    budgetConfig: [],
    priority: 0,
};

// A mixed €/% tiered config. The recipient tiers hold only the reward amount;
// the basket range and unit come from the matching Global CPA tier by index.
const tieredValues: RewardFormValues = {
    ...DEFAULT_REWARD_FORM,
    model: "tiered",
    globalCpaTiers: [
        { from: 0, to: 100, cpa: 10, unit: "amount" },
        { from: 100, to: "", cpa: 10, unit: "percent" },
    ],
    ambassadorTiers: [{ reward: 6 }, { reward: 4 }],
    refereeTiers: [{ reward: 2 }, { reward: 4 }],
};

describe("tiered rewards persistence", () => {
    it("emits one tiered reward per recipient, currency as amount and % as percent", () => {
        const draft = rewardFormToDraft(tieredValues, baseDraft);
        const referrer = draft.rule.rewards.find(
            (r) => r.recipient === "referrer"
        );
        const referee = draft.rule.rewards.find(
            (r) => r.recipient === "referee"
        );

        if (referrer?.amountType !== "tiered") throw new Error("no referrer");
        if (referee?.amountType !== "tiered") throw new Error("no referee");

        expect(referrer.tierField).toBe("purchase.amount");
        // Last tier carries no `maxValue` (∞ cap).
        expect(referrer.tiers).toEqual([
            { minValue: 0, maxValue: 100, amount: 6 },
            { minValue: 100, percent: 4 },
        ]);
        expect(referee.tiers).toEqual([
            { minValue: 0, maxValue: 100, amount: 2 },
            { minValue: 100, percent: 4 },
        ]);
    });

    it("round-trips through the draft, re-deriving the Global CPA table", () => {
        const draft = rewardFormToDraft(tieredValues, baseDraft);
        const restored = draftToRewardForm(draft);

        expect(restored.model).toBe("tiered");
        expect(restored.ambassadorTiers).toEqual([
            { reward: 6 },
            { reward: 4 },
        ]);
        expect(restored.refereeTiers).toEqual([{ reward: 2 }, { reward: 4 }]);
        // CPA isn't stored — re-derived as (ambassador + referee) / 80%; the
        // range and unit come back from the persisted tiers.
        expect(restored.globalCpaTiers).toEqual([
            { from: 0, to: 100, cpa: 10, unit: "amount" },
            { from: 100, to: "", cpa: 10, unit: "percent" },
        ]);
    });
});

describe("isRewardFormValid (tiered)", () => {
    it("passes when every tier has both rewards filled in", () => {
        expect(isRewardFormValid(tieredValues)).toBe(true);
    });

    it("passes when a tier's split doesn't match its CPA", () => {
        const offReco: RewardFormValues = {
            ...tieredValues,
            ambassadorTiers: [{ reward: 5 }, { reward: 4 }],
        };
        expect(isRewardFormValid(offReco)).toBe(true);
    });

    it("fails when a split reward is left empty", () => {
        const incomplete: RewardFormValues = {
            ...tieredValues,
            refereeTiers: [{ reward: "" }, { reward: 4 }],
        };
        expect(isRewardFormValid(incomplete)).toBe(false);
    });

    // The backend rejects a 0 tier amount; a tiered definition can't skip a range.
    it("fails when a tier reward is 0", () => {
        const zeroReferee: RewardFormValues = {
            ...tieredValues,
            refereeTiers: [{ reward: 0 }, { reward: 0 }],
        };
        expect(isRewardFormValid(zeroReferee)).toBe(false);
    });

    it("fails when basket ranges overlap", () => {
        const overlapping: RewardFormValues = {
            ...tieredValues,
            globalCpaTiers: [
                { from: 0, to: 100, cpa: 10, unit: "amount" },
                { from: 50, to: "", cpa: 10, unit: "percent" },
            ],
        };
        expect(isRewardFormValid(overlapping)).toBe(false);
    });

    it("fails when a tier's upper bound is below its lower bound", () => {
        const inverted: RewardFormValues = {
            ...tieredValues,
            globalCpaTiers: [
                { from: 500, to: 100, cpa: 10, unit: "amount" },
                { from: 500, to: "", cpa: 10, unit: "percent" },
            ],
        };
        expect(isRewardFormValid(inverted)).toBe(false);
    });

    // `CampaignManagementService` rejects a tier percent over 100 at publish.
    it("fails when a percent-unit tier exceeds 100", () => {
        const over: RewardFormValues = {
            ...tieredValues,
            globalCpaTiers: [
                { from: 0, to: 100, cpa: 10, unit: "amount" },
                { from: 100, to: "", cpa: 150, unit: "percent" },
            ],
        };
        expect(isRewardFormValid(over)).toBe(false);
    });

    it("allows an amount-unit tier above 100", () => {
        const bigAmount: RewardFormValues = {
            ...tieredValues,
            globalCpaTiers: [
                { from: 0, to: 100, cpa: 150, unit: "amount" },
                { from: 100, to: "", cpa: 10, unit: "percent" },
            ],
        };
        expect(isRewardFormValid(bigAmount)).toBe(true);
    });
});

// The backend caps a percentage reward at 100, so the wizard must reject one
// here rather than let it fail at publish.
describe("isRewardFormValid (percentage)", () => {
    const percentageValues: RewardFormValues = {
        ...DEFAULT_REWARD_FORM,
        model: "percentage",
        targetCpaPercent: 10,
        ambassadorPercent: 6,
        refereePercent: 2,
    };

    it("passes at a normal percentage", () => {
        expect(isRewardFormValid(percentageValues)).toBe(true);
    });

    it("passes at exactly 100", () => {
        expect(
            isRewardFormValid({
                ...percentageValues,
                targetCpaPercent: 100,
                ambassadorPercent: 60,
                refereePercent: 20,
            })
        ).toBe(true);
    });

    it("fails above 100", () => {
        expect(
            isRewardFormValid({
                ...percentageValues,
                targetCpaPercent: 150,
                ambassadorPercent: 90,
                refereePercent: 30,
            })
        ).toBe(false);
    });
});

describe("chaining preservation across a reward re-edit", () => {
    // The referral-chain step stores `chaining` on the referrer reward;
    // rewardFormToDraft rebuilds rule.rewards from scratch, so it must re-apply
    // the preserved chaining or editing the reward step would silently wipe it.
    it("re-applies the preserved chaining onto the rebuilt referrer reward", () => {
        const draftWithChaining: CampaignDraft = {
            ...baseDraft,
            rule: {
                trigger: "purchase",
                conditions: [],
                rewards: [
                    {
                        recipient: "referrer",
                        type: "token",
                        amountType: "fixed",
                        amount: 6,
                        chaining: { deperditionPerLevel: 20, maxDepth: 3 },
                    },
                ],
            },
        };
        const fixedValues: RewardFormValues = {
            ...DEFAULT_REWARD_FORM,
            model: "fixed",
            targetCpa: 10,
            ambassadorAmount: 6,
            refereeAmount: 2,
        };

        const result = rewardFormToDraft(fixedValues, draftWithChaining);
        const referrer = result.rule.rewards.find(
            (r) => r.recipient === "referrer"
        );

        expect(referrer?.chaining).toEqual({
            deperditionPerLevel: 20,
            maxDepth: 3,
        });
    });
});

describe("recalcCpaFromSplit", () => {
    // Inverse of the 80/20 pool split: CPA = (ambassador + referee) / 80%.
    it("derives the CPA from an Ambassador/Referee split", () => {
        expect(recalcCpaFromSplit(6, 2)).toBe(10);
    });

    it("rounds the derived CPA to 2 decimals", () => {
        // (3.33 + 1.11) / 0.8 = 5.55
        expect(recalcCpaFromSplit(3.33, 1.11)).toBe(5.55);
        // (1 + 0) / 0.8 = 1.25
        expect(recalcCpaFromSplit(1, 0)).toBe(1.25);
    });
});

describe("tieredRangesOverlap", () => {
    it("allows touching boundaries (0–100, 100–∞)", () => {
        expect(
            tieredRangesOverlap([
                { from: 0, to: 100, cpa: 10, unit: "amount" },
                { from: 100, to: "", cpa: 10, unit: "amount" },
            ])
        ).toBe(false);
    });

    it("flags a genuine overlap (0–100, 50–∞)", () => {
        expect(
            tieredRangesOverlap([
                { from: 0, to: 100, cpa: 10, unit: "amount" },
                { from: 50, to: "", cpa: 10, unit: "amount" },
            ])
        ).toBe(true);
    });

    it("ignores tiers without a lower bound", () => {
        expect(
            tieredRangesOverlap([
                { from: "", to: "", cpa: "", unit: "amount" },
                { from: 0, to: 100, cpa: 10, unit: "amount" },
            ])
        ).toBe(false);
    });
});

describe("tieredRangeInverted", () => {
    it("flags an upper bound below the lower bound, even when no range overlaps", () => {
        const tiers = [
            { from: 500, to: 100, cpa: 10, unit: "amount" as const },
            { from: 200, to: 300, cpa: 10, unit: "amount" as const },
        ];
        expect(tieredRangesOverlap(tiers)).toBe(false);
        expect(tieredRangeInverted(tiers)).toBe(true);
    });

    it("flags an empty range (upper bound equal to lower bound)", () => {
        expect(
            tieredRangeInverted([
                { from: 100, to: 100, cpa: 10, unit: "amount" },
            ])
        ).toBe(true);
    });

    it("accepts ordered ranges, an open last tier and unfilled bounds", () => {
        expect(
            tieredRangeInverted([
                { from: 0, to: 100, cpa: 10, unit: "amount" },
                { from: 100, to: "", cpa: 10, unit: "amount" },
                { from: "", to: 50, cpa: "", unit: "amount" },
            ])
        ).toBe(false);
    });
});

const scopedDraft = (
    productScope: CampaignDraft["rule"]["productScope"]
): CampaignDraft => ({
    ...baseDraft,
    rule: { ...baseDraft.rule, productScope },
});

describe("reward basis", () => {
    it("offers a basis choice only on a scoped campaign", () => {
        expect(supportsMatchedBasis(baseDraft)).toBe(false);
        expect(
            supportsMatchedBasis(
                scopedDraft([{ field: "sku", operator: "in", value: ["A"] }])
            )
        ).toBe(true);
    });

    it("forces a matched basis only for a negated scope", () => {
        expect(
            requiresMatchedBasis(
                scopedDraft([{ field: "sku", operator: "in", value: ["A"] }])
            )
        ).toBe(false);
        expect(
            requiresMatchedBasis(
                scopedDraft([
                    { field: "sku", operator: "not_in", value: ["CHEAP"] },
                ])
            )
        ).toBe(true);
    });

    it("treats a `none` group as negated, like the backend does", () => {
        expect(
            requiresMatchedBasis(
                scopedDraft({
                    logic: "none",
                    conditions: [
                        { field: "sku", operator: "eq", value: "CHEAP" },
                    ],
                })
            )
        ).toBe(true);
    });

    it("writes matched_items_amount for a scoped percentage reward", () => {
        const draft = scopedDraft([
            { field: "sku", operator: "in", value: ["A"] },
        ]);
        const { rule } = rewardFormToDraft(
            {
                ...DEFAULT_REWARD_FORM,
                model: "percentage",
                rewardBasis: "matchedItems",
                targetCpaPercent: 10,
                ambassadorPercent: 6,
                refereePercent: 2,
            },
            draft
        );
        for (const reward of rule.rewards) {
            expect(reward).toMatchObject({
                percentOf: "matched_items_amount",
            });
        }
    });

    it("writes purchase.matchedAmount for a scoped tiered reward", () => {
        const draft = scopedDraft([
            { field: "sku", operator: "in", value: ["A"] },
        ]);
        const { rule } = rewardFormToDraft(
            { ...tieredValues, rewardBasis: "matchedItems" },
            draft
        );
        for (const reward of rule.rewards) {
            expect(reward).toMatchObject({
                tierField: "purchase.matchedAmount",
            });
        }
    });

    it("downgrades a matched basis to the basket when the scope is gone", () => {
        const { rule } = rewardFormToDraft(
            {
                ...DEFAULT_REWARD_FORM,
                model: "percentage",
                rewardBasis: "matchedItems",
                targetCpaPercent: 10,
                ambassadorPercent: 6,
                refereePercent: 2,
            },
            baseDraft
        );
        for (const reward of rule.rewards) {
            expect(reward).toMatchObject({ percentOf: "purchase_amount" });
        }
    });

    it("upgrades to a matched basis when the scope is negated", () => {
        const draft = scopedDraft([
            { field: "sku", operator: "not_in", value: ["CHEAP"] },
        ]);
        const { rule } = rewardFormToDraft(
            {
                ...DEFAULT_REWARD_FORM,
                model: "percentage",
                rewardBasis: "basket",
                targetCpaPercent: 10,
                ambassadorPercent: 6,
                refereePercent: 2,
            },
            draft
        );
        for (const reward of rule.rewards) {
            expect(reward).toMatchObject({
                percentOf: "matched_items_amount",
            });
        }
    });

    it("reads the persisted basis back off the rule", () => {
        const draft: CampaignDraft = {
            ...baseDraft,
            rule: {
                ...baseDraft.rule,
                productScope: [{ field: "sku", operator: "in", value: ["A"] }],
                rewards: [
                    {
                        recipient: "referrer",
                        type: "token",
                        amountType: "percentage",
                        percent: 6,
                        percentOf: "matched_items_amount",
                    },
                ],
            },
        };
        expect(draftToRewardForm(draft).rewardBasis).toBe("matchedItems");
    });

    it("rejects a fixed reward when the scope forces a matched basis", () => {
        const fixed: RewardFormValues = {
            ...DEFAULT_REWARD_FORM,
            model: "fixed",
            targetCpa: 10,
            ambassadorAmount: 6,
            refereeAmount: 2,
        };
        expect(isRewardFormValid(fixed)).toBe(true);
        expect(isRewardFormValid(fixed, { requiresMatchedBasis: true })).toBe(
            false
        );
    });
});

describe("non-purchase campaign", () => {
    const referralDraft: CampaignDraft = {
        ...baseDraft,
        rule: { ...baseDraft.rule, trigger: "referral" },
    };

    // Both fields read a purchase; the step hides them off that trigger, so a
    // stale form value must not sneak back into the rule.
    it("saves no minimum purchase nor lockup", () => {
        const values: RewardFormValues = {
            ...DEFAULT_REWARD_FORM,
            model: "fixed",
            targetCpa: 10,
            ambassadorAmount: 6,
            refereeAmount: 2,
            minPurchaseAmount: 50,
            lockupDays: 7,
        };
        const draft = rewardFormToDraft(values, referralDraft);
        expect(draft.rule.defaultLockupSeconds).toBe(0);
        expect(getMinPurchaseAmount(draft.rule)).toBe(0);
    });
});

const FIRST = { from: 1, to: 1 };

// 10 € + 2 € on the first payment (CPA 15), then 5 € + 1 € on steps 2 to 5.
const subscriptionFixed: RewardFormValues = {
    ...DEFAULT_REWARD_FORM,
    subscription: true,
    model: "fixed",
    periods: [
        fixedPeriod(1, values(15, 10, 2)),
        fixedPeriod(5, values(7.5, 5, 1)),
    ],
    inactivityDays: 60,
};

const subscriptionPercentage: RewardFormValues = {
    ...DEFAULT_REWARD_FORM,
    subscription: true,
    model: "percentage",
    periods: [
        percentPeriod(1, values(12.5, 8, 2)),
        percentPeriod(4, values(5, 3, 1)),
    ],
};

const fixedDef = (
    recipient: "referrer" | "referee",
    amount: number,
    cycles?: { from: number; to: number }
) => ({
    recipient,
    type: "token" as const,
    amountType: "fixed" as const,
    amount,
    ...(cycles ? { cycles } : {}),
});

const storedPlan = (
    rewards: CampaignDraft["rule"]["rewards"]
): CampaignDraft => ({
    ...baseDraft,
    rule: {
        ...baseDraft.rule,
        rewards,
        subscription: { inactivityDays: 30 },
    },
});

describe("subscription rewards: periods", () => {
    it("writes one ranged definition per period and paid side", () => {
        const { rule } = rewardFormToDraft(subscriptionFixed, baseDraft);

        expect(rule.subscription).toEqual({ inactivityDays: 60 });
        expect(rule.rewards).toEqual([
            fixedDef("referrer", 10, FIRST),
            fixedDef("referee", 2, FIRST),
            fixedDef("referrer", 5, { from: 2, to: 5 }),
            fixedDef("referee", 1, { from: 2, to: 5 }),
        ]);
    });

    it("pays the whole plan from one definition per side when there is a single period", () => {
        const { rule } = rewardFormToDraft(
            {
                ...subscriptionFixed,
                periods: [fixedPeriod(6, values(10, 6, 2))],
            },
            baseDraft
        );

        expect(rule.rewards).toEqual([
            fixedDef("referrer", 6, { from: 1, to: 6 }),
            fixedDef("referee", 2, { from: 1, to: 6 }),
        ]);
    });

    it("round-trips the periods with their CPA re-derived from the split", () => {
        const form = draftToRewardForm(
            rewardFormToDraft(subscriptionFixed, baseDraft)
        );

        expect(form).toMatchObject({
            subscription: true,
            unsupportedSubscription: false,
            model: "fixed",
            inactivityDays: 60,
            periods: subscriptionFixed.periods,
        });
    });

    it("writes percentage periods as a share of each payment", () => {
        const { rule } = rewardFormToDraft(subscriptionPercentage, baseDraft);

        expect(rule.rewards[2]).toEqual({
            recipient: "referrer",
            type: "token",
            amountType: "percentage",
            percent: 3,
            percentOf: "purchase_amount",
            cycles: { from: 2, to: 4 },
        });
        expect(draftToRewardForm({ ...baseDraft, rule }).periods).toMatchObject(
            subscriptionPercentage.periods
        );
    });

    it("skips a period without reward and keeps the steps of the periods after it", () => {
        const withGap: RewardFormValues = {
            ...subscriptionFixed,
            periods: [
                fixedPeriod(1, values(15, 10, 2)),
                fixedPeriod(3),
                fixedPeriod(6, values(7.5, 5, 1)),
            ],
        };
        const { rule } = rewardFormToDraft(withGap, baseDraft);

        expect(rule.rewards.map((r) => r.cycles)).toEqual([
            FIRST,
            FIRST,
            { from: 4, to: 6 },
            { from: 4, to: 6 },
        ]);
        expect(draftToRewardForm({ ...baseDraft, rule }).periods).toEqual(
            withGap.periods
        );
    });

    it("cuts stored ranges into periods wherever either side changes", () => {
        const form = draftToRewardForm(
            storedPlan([
                fixedDef("referrer", 10, FIRST),
                fixedDef("referrer", 5, { from: 2, to: 5 }),
                fixedDef("referee", 2, { from: 1, to: 3 }),
            ])
        );

        expect(form.periods.map((p) => p.to)).toEqual([1, 3, 5]);
        expect(form.periods.map((p) => p.amount)).toEqual([
            values(15, 10, 2),
            values(8.75, 5, 2),
            values(6.25, 5, 0),
        ]);
    });

    it("starts a new plan with one empty period", () => {
        const form = draftToRewardForm(storedPlan([]));

        expect(form.model).toBe("");
        expect(form.periods).toEqual([fixedPeriod("")]);
    });

    it("defaults the inactivity window when the rule stores none", () => {
        const draft: CampaignDraft = {
            ...baseDraft,
            rule: { ...baseDraft.rule, subscription: {} },
        };

        expect(draftToRewardForm(draft).inactivityDays).toBe(90);
    });

    it("drops chaining, which a subscription plan cannot carry", () => {
        const chained: CampaignDraft = {
            ...baseDraft,
            rule: {
                ...baseDraft.rule,
                rewards: [
                    {
                        ...fixedDef("referrer", 1),
                        chaining: { deperditionPerLevel: 20 },
                    },
                ],
            },
        };

        const { rule } = rewardFormToDraft(subscriptionFixed, chained);

        expect(rule.rewards.some((r) => r.chaining)).toBe(false);
    });

    it("removes the subscription block and the cycles off a subscription form", () => {
        const subscribed = rewardFormToDraft(subscriptionFixed, baseDraft);
        const plain = rewardFormToDraft(
            {
                ...DEFAULT_REWARD_FORM,
                model: "fixed",
                targetCpa: 10,
                ambassadorAmount: 6,
                refereeAmount: 2,
            },
            subscribed
        );

        expect(plain.rule).not.toHaveProperty("subscription");
        expect(plain.rule.rewards.some((r) => r.cycles)).toBe(false);
    });

    it("saves no plan from a subscription form on a campaign that is not a purchase", () => {
        const { rule } = rewardFormToDraft(subscriptionFixed, {
            ...baseDraft,
            rule: { ...baseDraft.rule, trigger: "referral" },
        });

        expect(rule).not.toHaveProperty("subscription");
        expect(rule.rewards.some((r) => r.cycles)).toBe(false);
    });

    it("saves no reward while the model is not chosen yet", () => {
        const { rule } = rewardFormToDraft(
            { ...DEFAULT_REWARD_FORM, subscription: true },
            baseDraft
        );

        expect(rule.rewards).toEqual([]);
        expect(rule.subscription).toEqual({ inactivityDays: 90 });
    });
});

describe("subscription rewards: unsupported stored shapes", () => {
    type Rewards = CampaignDraft["rule"]["rewards"];
    const percentage = (
        extra: Partial<{
            percentOf: "purchase_amount" | "matched_items_amount";
            maxAmount: number;
        }>
    ): Rewards[number] => ({
        recipient: "referrer",
        type: "token",
        amountType: "percentage",
        percent: 3,
        percentOf: "purchase_amount",
        cycles: FIRST,
        ...extra,
    });
    const unsupported: [string, Rewards][] = [
        ["a reward without cycles", [fixedDef("referrer", 5)]],
        [
            "overlapping ranges on one side",
            [
                fixedDef("referrer", 5, { from: 1, to: 4 }),
                fixedDef("referrer", 2, { from: 3, to: 6 }),
            ],
        ],
        [
            "a plan mixing fixed and percentage definitions",
            [fixedDef("referrer", 10, FIRST), percentage({})],
        ],
        [
            "a percentage computed on the matched items",
            [percentage({ percentOf: "matched_items_amount" })],
        ],
        [
            "a fractional range bound",
            [fixedDef("referrer", 5, { from: 1, to: 2.5 })],
        ],
        ["a capped percentage", [percentage({ maxAmount: 20 })]],
        [
            "a range past the 24th step",
            [fixedDef("referrer", 5, { from: 1, to: 30 })],
        ],
        [
            "a tiered definition",
            [
                {
                    recipient: "referrer",
                    type: "token",
                    amountType: "tiered",
                    tierField: "purchase.amount",
                    tiers: [{ minValue: 0, amount: 5 }],
                    cycles: FIRST,
                },
            ],
        ],
    ];

    it.each(unsupported)("flags %s", (_, rewards) => {
        expect(
            draftToRewardForm(storedPlan(rewards)).unsupportedSubscription
        ).toBe(true);
    });

    it("leaves the stored rewards and rule exactly as they were when saving", () => {
        const draft = storedPlan([fixedDef("referrer", 5)]);
        const form = draftToRewardForm(draft);

        expect(
            rewardFormToDraft(
                { ...form, lockupDays: 30, referralOnly: false },
                draft
            )
        ).toBe(draft);
    });

    it("keeps Continue available so the untouched plan can move on", () => {
        const form = draftToRewardForm(storedPlan([fixedDef("referrer", 5)]));

        expect(isRewardFormValid(form)).toBe(true);
        expect(form.inactivityDays).toBe(30);
    });
});

describe("isRewardFormValid (subscription)", () => {
    it("passes a complete fixed or percentage plan", () => {
        expect(isRewardFormValid(subscriptionFixed)).toBe(true);
        expect(isRewardFormValid(subscriptionPercentage)).toBe(true);
    });

    it("fails while the periods have an issue", () => {
        expect(
            isRewardFormValid({
                ...subscriptionFixed,
                periods: [fixedPeriod("", values(10, 6, 2))],
            })
        ).toBe(false);
    });

    it("fails the tiered model, which subscriptions can't use", () => {
        expect(
            isRewardFormValid({ ...subscriptionFixed, model: "tiered" })
        ).toBe(false);
    });

    it("fails on a negated product scope, which needs the matched basis a subscription forbids", () => {
        expect(
            isRewardFormValid(subscriptionPercentage, {
                requiresMatchedBasis: true,
            })
        ).toBe(false);
    });
});

describe("subscription rewards: progression", () => {
    it("writes nothing extra for the default cycle progression", () => {
        const { rule } = rewardFormToDraft(subscriptionFixed, baseDraft);

        expect(rule.subscription).toEqual({ inactivityDays: 60 });
    });

    it("writes an amount progression with its step amount, keeping the percentages", () => {
        const { rule } = rewardFormToDraft(
            {
                ...subscriptionPercentage,
                stepBy: "amount",
                stepAmount: 30,
                stepDays: 45,
            },
            baseDraft
        );

        expect(rule.subscription).toEqual({
            inactivityDays: 90,
            stepBy: "amount",
            stepAmount: 30,
        });
        expect(rule.rewards[2]).toMatchObject({
            amountType: "percentage",
            percent: 3,
            cycles: { from: 2, to: 4 },
        });
    });

    it("writes a duration progression with its step days only", () => {
        const { rule } = rewardFormToDraft(
            {
                ...subscriptionFixed,
                stepBy: "duration",
                stepDays: 28,
                stepAmount: 30,
            },
            baseDraft
        );

        expect(rule.subscription).toEqual({
            inactivityDays: 60,
            stepBy: "duration",
            stepDays: 28,
        });
    });

    it.each([
        { stepBy: "amount", stepAmount: 25 },
        { stepBy: "duration", stepDays: 14 },
    ] as const)("round-trips the $stepBy progression", (progression) => {
        const restored = draftToRewardForm(
            rewardFormToDraft(
                { ...subscriptionFixed, ...progression },
                baseDraft
            )
        );

        expect(restored).toMatchObject({
            ...progression,
            model: "fixed",
            periods: subscriptionFixed.periods,
            unsupportedSubscription: false,
        });
    });

    it("reads a stored plan without a progression as counting renewals", () => {
        const form = draftToRewardForm(
            rewardFormToDraft(subscriptionFixed, baseDraft)
        );

        expect(form.stepBy).toBe("cycle");
    });
});

describe("isRewardFormValid (subscription progression)", () => {
    it("needs a positive amount per reward on an amount progression", () => {
        const amount = { ...subscriptionFixed, stepBy: "amount" as const };
        expect(isRewardFormValid({ ...amount, stepAmount: "" })).toBe(false);
        expect(isRewardFormValid({ ...amount, stepAmount: 0 })).toBe(false);
        expect(isRewardFormValid({ ...amount, stepAmount: 30 })).toBe(true);
    });

    it("needs 1 to 365 whole days per reward on a duration progression", () => {
        const duration = { ...subscriptionFixed, stepBy: "duration" as const };
        for (const stepDays of [0, 366, "", 1.5] as const) {
            expect(isRewardFormValid({ ...duration, stepDays })).toBe(false);
        }
        expect(isRewardFormValid({ ...duration, stepDays: 30 })).toBe(true);
    });

    it("keeps each progression to the models it can pay", () => {
        expect(
            isRewardFormValid({
                ...subscriptionPercentage,
                stepBy: "amount",
                stepAmount: 30,
            })
        ).toBe(true);
        expect(
            isRewardFormValid({
                ...subscriptionPercentage,
                stepBy: "duration",
                stepDays: 30,
            })
        ).toBe(false);
    });
});

describe("exclude subscription orders", () => {
    const EXCLUDE = {
        field: "purchase.isSubscription",
        operator: "neq" as const,
        value: true,
    };
    const fixedValues: RewardFormValues = {
        ...DEFAULT_REWARD_FORM,
        model: "fixed",
        targetCpa: 10,
        ambassadorAmount: 6,
        refereeAmount: 2,
    };

    it("adds the purchase.isSubscription neq true condition when toggled on", () => {
        const { rule } = rewardFormToDraft(
            { ...fixedValues, excludeSubscriptions: true },
            baseDraft
        );

        expect(rule.conditions).toContainEqual(EXCLUDE);
    });

    it("removes the condition when toggled off", () => {
        const excluded = rewardFormToDraft(
            { ...fixedValues, excludeSubscriptions: true },
            baseDraft
        );

        const { rule } = rewardFormToDraft(
            { ...fixedValues, excludeSubscriptions: false },
            excluded
        );

        expect(rule.conditions).not.toContainEqual(EXCLUDE);
    });

    it("reads the stored condition back into the form", () => {
        const draft: CampaignDraft = {
            ...baseDraft,
            rule: { ...baseDraft.rule, conditions: [EXCLUDE] },
        };

        expect(draftToRewardForm(draft).excludeSubscriptions).toBe(true);
        expect(draftToRewardForm(baseDraft).excludeSubscriptions).toBe(false);
    });

    it("round-trips for the tiered model too", () => {
        const draft = rewardFormToDraft(
            { ...tieredValues, excludeSubscriptions: true },
            baseDraft
        );

        expect(draftToRewardForm(draft).excludeSubscriptions).toBe(true);
    });

    it("leaves the other conditions alone", () => {
        const { rule } = rewardFormToDraft(
            {
                ...fixedValues,
                excludeSubscriptions: true,
                minPurchaseAmount: 20,
            },
            baseDraft
        );

        expect(getMinPurchaseAmount(rule)).toBe(20);
        expect(rule.conditions).toHaveLength(3);
    });

    it("is not written on a subscription campaign, which only matches subscription checkouts", () => {
        const { rule } = rewardFormToDraft(
            { ...subscriptionFixed, excludeSubscriptions: true },
            baseDraft
        );

        expect(rule.conditions).not.toContainEqual(EXCLUDE);
    });

    it("is not written off a purchase trigger", () => {
        const { rule } = rewardFormToDraft(
            { ...fixedValues, excludeSubscriptions: true },
            { ...baseDraft, rule: { ...baseDraft.rule, trigger: "referral" } }
        );

        expect(rule.conditions).not.toContainEqual(EXCLUDE);
    });
});
