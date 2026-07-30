import { describe, expect, it } from "vitest";
import {
    type CampaignDraft,
    getMinPurchaseAmount,
} from "@/stores/campaignStore";
import {
    DEFAULT_REWARD_FORM,
    draftToRewardForm,
    isRewardFormValid,
    type RewardFormValues,
    recalcCpaFromSplit,
    requiresMatchedBasis,
    rewardFormToDraft,
    supportsMatchedBasis,
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

    // The split is no longer forced to equal 80% of the CPA — the distribution
    // bar shows the recommendation, but any positive amounts are accepted.
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

/* ------------------------------------------------------------------ */
/*  Product scope <-> reward basis                                     */
/* ------------------------------------------------------------------ */

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
