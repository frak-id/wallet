import { describe, expect, it } from "vitest";
import type { CampaignDraft } from "@/stores/campaignStore";
import {
    computeChainPreview,
    DEFAULT_REFERRAL_CHAIN_FORM,
    draftToReferralChainForm,
    isReferralChainFormValid,
    type ReferralChainFormValues,
    referralChainFormToDraft,
} from "./utils";

const draftWithReferrer: CampaignDraft = {
    merchantId: "m1",
    name: "Test",
    rule: {
        trigger: "purchase",
        conditions: [],
        rewards: [
            {
                recipient: "referrer",
                type: "token",
                amountType: "fixed",
                amount: 6,
            },
            {
                recipient: "referee",
                type: "token",
                amountType: "fixed",
                amount: 2,
            },
        ],
    },
    metadata: { goal: undefined, specialCategories: [], territories: [] },
    budgetConfig: [],
    priority: 0,
};

const draftNoReferrer: CampaignDraft = {
    ...draftWithReferrer,
    rule: { trigger: "purchase", conditions: [], rewards: [] },
};

describe("referral chain persistence", () => {
    it("writes chaining onto every referrer reward when enabled", () => {
        const values: ReferralChainFormValues = {
            enabled: true,
            deperditionPerLevel: 20,
            maxDepth: 3,
        };
        const draft = referralChainFormToDraft(values, draftWithReferrer);
        const referrer = draft.rule.rewards.find(
            (r) => r.recipient === "referrer"
        );
        const referee = draft.rule.rewards.find(
            (r) => r.recipient === "referee"
        );

        expect(referrer?.chaining).toEqual({
            deperditionPerLevel: 20,
            maxDepth: 3,
        });
        // Chaining never lands on the referee reward.
        expect(referee?.chaining).toBeUndefined();
    });

    it("omits maxDepth when max levels is left empty (unlimited)", () => {
        const values: ReferralChainFormValues = {
            enabled: true,
            deperditionPerLevel: 15,
            maxDepth: "",
        };
        const draft = referralChainFormToDraft(values, draftWithReferrer);
        const referrer = draft.rule.rewards.find(
            (r) => r.recipient === "referrer"
        );

        expect(referrer?.chaining).toEqual({ deperditionPerLevel: 15 });
        expect(referrer?.chaining).not.toHaveProperty("maxDepth");
    });

    it("clears chaining from referrer rewards when disabled", () => {
        const enabled = referralChainFormToDraft(
            { enabled: true, deperditionPerLevel: 20, maxDepth: 3 },
            draftWithReferrer
        );
        const disabled = referralChainFormToDraft(
            { ...DEFAULT_REFERRAL_CHAIN_FORM },
            enabled
        );
        const referrer = disabled.rule.rewards.find(
            (r) => r.recipient === "referrer"
        );

        expect(referrer?.chaining).toBeUndefined();
    });

    it("round-trips a configured chain through the draft", () => {
        const values: ReferralChainFormValues = {
            enabled: true,
            deperditionPerLevel: 20,
            maxDepth: 3,
        };
        const draft = referralChainFormToDraft(values, draftWithReferrer);
        expect(draftToReferralChainForm(draft)).toEqual(values);
    });

    it("reads an empty form from a draft without chaining", () => {
        expect(draftToReferralChainForm(draftWithReferrer)).toEqual(
            DEFAULT_REFERRAL_CHAIN_FORM
        );
    });
});

describe("isReferralChainFormValid", () => {
    it("is valid when disabled (skippable step)", () => {
        expect(
            isReferralChainFormValid(
                DEFAULT_REFERRAL_CHAIN_FORM,
                draftWithReferrer
            )
        ).toBe(true);
    });

    it("is valid when enabled with a decrease in [50,100) and a referrer reward", () => {
        expect(
            isReferralChainFormValid(
                { enabled: true, deperditionPerLevel: 80, maxDepth: 3 },
                draftWithReferrer
            )
        ).toBe(true);
    });

    it("accepts an empty (unlimited) max level", () => {
        expect(
            isReferralChainFormValid(
                { enabled: true, deperditionPerLevel: 80, maxDepth: "" },
                draftWithReferrer
            )
        ).toBe(true);
    });

    it("rejects a decrease of 0 or 100", () => {
        expect(
            isReferralChainFormValid(
                { enabled: true, deperditionPerLevel: 0, maxDepth: 3 },
                draftWithReferrer
            )
        ).toBe(false);
        expect(
            isReferralChainFormValid(
                { enabled: true, deperditionPerLevel: 100, maxDepth: 3 },
                draftWithReferrer
            )
        ).toBe(false);
    });

    it("rejects a decrease below the 50% floor", () => {
        expect(
            isReferralChainFormValid(
                { enabled: true, deperditionPerLevel: 49, maxDepth: 3 },
                draftWithReferrer
            )
        ).toBe(false);
        expect(
            isReferralChainFormValid(
                { enabled: true, deperditionPerLevel: 50, maxDepth: 3 },
                draftWithReferrer
            )
        ).toBe(true);
    });

    it("rejects a non-integer or sub-1 max level", () => {
        expect(
            isReferralChainFormValid(
                { enabled: true, deperditionPerLevel: 80, maxDepth: 1.5 },
                draftWithReferrer
            )
        ).toBe(false);
        expect(
            isReferralChainFormValid(
                { enabled: true, deperditionPerLevel: 80, maxDepth: 0 },
                draftWithReferrer
            )
        ).toBe(false);
    });

    it("rejects enabling without a referrer reward to attach to", () => {
        expect(
            isReferralChainFormValid(
                { enabled: true, deperditionPerLevel: 80, maxDepth: 3 },
                draftNoReferrer
            )
        ).toBe(false);
    });

    it("accepts a max level of 1", () => {
        expect(
            isReferralChainFormValid(
                { enabled: true, deperditionPerLevel: 80, maxDepth: 1 },
                draftWithReferrer
            )
        ).toBe(true);
    });

    it("caps max levels at 20", () => {
        expect(
            isReferralChainFormValid(
                { enabled: true, deperditionPerLevel: 80, maxDepth: 20 },
                draftWithReferrer
            )
        ).toBe(true);
        expect(
            isReferralChainFormValid(
                { enabled: true, deperditionPerLevel: 80, maxDepth: 21 },
                draftWithReferrer
            )
        ).toBe(false);
    });
});

describe("computeChainPreview (backend-aligned, conserved split)", () => {
    it("matches the worked example T=6, decrease=20%, depth=4", () => {
        const rows = computeChainPreview(6, 20, 4);
        expect(rows.map((r) => r.amount)).toEqual([1.2, 0.96, 0.77, 3.07]);
    });

    it("conserves the total (Σ rounded amounts === base)", () => {
        const rows = computeChainPreview(6, 20, 4);
        const sum = rows.reduce((acc, r) => acc + r.amount, 0);
        expect(Math.round(sum * 100) / 100).toBe(6);
    });

    it("expresses each member's share as a percentage summing to 100", () => {
        const rows = computeChainPreview(6, 20, 4);
        const shareSum = rows.reduce((acc, r) => acc + r.share, 0);
        expect(Math.round(shareSum)).toBe(100);
    });

    it("returns a single full-amount row when depth is 1", () => {
        expect(computeChainPreview(6, 20, 1)).toEqual([
            { level: 0, amount: 6, share: 100 },
        ]);
    });

    it("conserves the total for an adversarial rounding case (1, 2%, 7)", () => {
        const rows = computeChainPreview(1, 2, 7);
        const sum = rows.reduce((acc, r) => acc + r.amount, 0);
        expect(Math.round(sum * 100) / 100).toBe(1);
        const shareSum = rows.reduce((acc, r) => acc + r.share, 0);
        expect(Math.round(shareSum * 100) / 100).toBe(100);
    });

    it("renders one row per level at the default depth", () => {
        const rows = computeChainPreview(10, 10, 5);
        expect(rows).toHaveLength(5);
        expect(rows.map((r) => r.level)).toEqual([0, 1, 2, 3, 4]);
        const sum = rows.reduce((acc, r) => acc + r.amount, 0);
        expect(Math.round(sum * 100) / 100).toBe(10);
    });
});
