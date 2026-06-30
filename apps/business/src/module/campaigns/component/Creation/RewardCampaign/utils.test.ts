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
