import { describe, expect, it } from "vitest";
import type { CampaignDraft } from "@/stores/campaignStore";
import {
    DEFAULT_REWARD_FORM,
    draftToRewardForm,
    isRewardFormValid,
    type RewardFormValues,
    rewardFormToDraft,
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

// A mixed €/% tiered config whose splits are exactly 80% of each tier's CPA.
const tieredValues: RewardFormValues = {
    ...DEFAULT_REWARD_FORM,
    model: "tiered",
    globalCpaTiers: [
        { from: 0, to: 100, cpa: 10, unit: "amount" },
        { from: 100, to: "", cpa: 10, unit: "percent" },
    ],
    ambassadorTiers: [
        { from: 0, to: 100, reward: 6, unit: "amount" },
        { from: 100, to: "", reward: 4, unit: "percent" },
    ],
    refereeTiers: [
        { from: 0, to: 100, reward: 2, unit: "amount" },
        { from: 100, to: "", reward: 4, unit: "percent" },
    ],
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
        expect(restored.ambassadorTiers).toEqual(tieredValues.ambassadorTiers);
        expect(restored.refereeTiers).toEqual(tieredValues.refereeTiers);
        // CPA isn't stored — re-derived as (ambassador + referee) / 80%.
        expect(restored.globalCpaTiers).toEqual([
            { from: 0, to: 100, cpa: 10, unit: "amount" },
            { from: 100, to: "", cpa: 10, unit: "percent" },
        ]);
    });
});

describe("isRewardFormValid (tiered)", () => {
    it("passes when every tier's split equals 80% of its CPA", () => {
        expect(isRewardFormValid(tieredValues)).toBe(true);
    });

    it("fails when a tier's split doesn't match its CPA", () => {
        const bad: RewardFormValues = {
            ...tieredValues,
            ambassadorTiers: [
                { from: 0, to: 100, reward: 5, unit: "amount" },
                { from: 100, to: "", reward: 4, unit: "percent" },
            ],
        };
        expect(isRewardFormValid(bad)).toBe(false);
    });

    it("fails when a split reward is left empty", () => {
        const incomplete: RewardFormValues = {
            ...tieredValues,
            refereeTiers: [
                { from: 0, to: 100, reward: "", unit: "amount" },
                { from: 100, to: "", reward: 4, unit: "percent" },
            ],
        };
        expect(isRewardFormValid(incomplete)).toBe(false);
    });

    // A zero reward sums to 80% of CPA but the backend rejects a 0 tier amount.
    it("fails when a tier reward is 0 even if the split still hits 80%", () => {
        const zeroReferee: RewardFormValues = {
            ...tieredValues,
            ambassadorTiers: [
                { from: 0, to: 100, reward: 8, unit: "amount" },
                { from: 100, to: "", reward: 8, unit: "percent" },
            ],
            refereeTiers: [
                { from: 0, to: 100, reward: 0, unit: "amount" },
                { from: 100, to: "", reward: 0, unit: "percent" },
            ],
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
