import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import type { CampaignDraft } from "./campaignStore";
import {
    buildApiPayload,
    campaignToDraft,
    getMinPurchaseAmount,
    getReferralOnly,
    getStartDate,
    setMinPurchaseAmount,
    setReferralOnly,
    setStartDate,
} from "./campaignStore";

const REFERRAL_CONDITION = {
    field: "attribution.referrerIdentityGroupId",
    operator: "exists" as const,
    value: true,
};

const mockCampaignDraft: CampaignDraft = {
    merchantId: "mock-merchant-id",
    name: "Test Campaign",
    rule: {
        trigger: "purchase",
        conditions: [REFERRAL_CONDITION],
        rewards: [
            {
                recipient: "referrer",
                type: "token",
                amountType: "fixed",
                amount: 10,
            },
        ],
    },
    metadata: {
        goal: "awareness",
        specialCategories: [],
        territories: ["US", "FR"],
    },
    budgetConfig: [
        {
            label: "Monthly",
            durationInSeconds: 2592000,
            amount: 100,
        },
    ],
    expiresAt: "2024-12-31T00:00:00.000Z",
    priority: 0,
};

describe("campaignStore", () => {
    describe("initial state", () => {
        test("should have correct initial values", ({
            freshCampaignStore,
        }: TestContext) => {
            const state = freshCampaignStore.getState();

            expect(state.isSuccess).toBe(false);
            expect(state.draft.name).toBe("");
            expect(state.draft.rule.trigger).toBe("purchase");
            expect(state.draft.metadata.goal).toBeUndefined();
            // Referral-only is the default, encoded as a rule condition.
            expect(getReferralOnly(state.draft.rule)).toBe(true);
        });
    });

    describe("setDraft", () => {
        test("should update draft data", ({
            freshCampaignStore,
        }: TestContext) => {
            freshCampaignStore.getState().setDraft(mockCampaignDraft);

            expect(freshCampaignStore.getState().draft).toEqual(
                mockCampaignDraft
            );
        });

        test("should persist draft data", ({
            freshCampaignStore,
        }: TestContext) => {
            freshCampaignStore.getState().setDraft(mockCampaignDraft);

            const stored = localStorage.getItem("campaign-draft-v5");
            expect(stored).toBeTruthy();
        });
    });

    describe("updateDraft", () => {
        test("should update draft with function", ({
            freshCampaignStore,
        }: TestContext) => {
            freshCampaignStore.getState().setDraft(mockCampaignDraft);
            freshCampaignStore
                .getState()
                .updateDraft((d) => ({ ...d, name: "Updated Title" }));

            expect(freshCampaignStore.getState().draft.name).toBe(
                "Updated Title"
            );
        });

        test("should preserve other fields when updating", ({
            freshCampaignStore,
        }: TestContext) => {
            freshCampaignStore.getState().setDraft(mockCampaignDraft);
            freshCampaignStore
                .getState()
                .updateDraft((d) => ({ ...d, name: "New Name" }));

            expect(freshCampaignStore.getState().draft.merchantId).toBe(
                "mock-merchant-id"
            );
            expect(freshCampaignStore.getState().draft.priority).toBe(0);
        });
    });

    describe("setSuccess", () => {
        test("should set isSuccess to true", ({
            freshCampaignStore,
        }: TestContext) => {
            freshCampaignStore.getState().setSuccess(true);

            expect(freshCampaignStore.getState().isSuccess).toBe(true);
        });
    });

    describe("reset", () => {
        test("should reset all state to initial values", ({
            freshCampaignStore,
        }: TestContext) => {
            freshCampaignStore.getState().setDraft(mockCampaignDraft);
            freshCampaignStore.getState().setSuccess(true);

            freshCampaignStore.getState().reset();

            const state = freshCampaignStore.getState();
            expect(state.isSuccess).toBe(false);
            expect(state.draft.name).toBe("");
            expect(state.draft.rule.trigger).toBe("purchase");
        });
    });

    describe("persistence", () => {
        test("should persist draft", ({ freshCampaignStore }: TestContext) => {
            freshCampaignStore.getState().setDraft(mockCampaignDraft);

            const stored = localStorage.getItem("campaign-draft-v5");
            expect(stored).toBeTruthy();

            const parsed = JSON.parse(stored || "{}");
            expect(parsed.state.draft).toBeDefined();
        });

        test("should not persist isSuccess", ({
            freshCampaignStore,
        }: TestContext) => {
            freshCampaignStore.getState().setSuccess(true);

            const stored = localStorage.getItem("campaign-draft-v5");
            if (stored) {
                const parsed = JSON.parse(stored);
                expect(parsed.state.isSuccess).toBeUndefined();
            }
        });
    });
});

describe("rule condition helpers", () => {
    test("getReferralOnly reflects the referral condition", () => {
        expect(getReferralOnly(mockCampaignDraft.rule)).toBe(true);
        const without = setReferralOnly(mockCampaignDraft.rule, false);
        expect(getReferralOnly(without)).toBe(false);
    });

    test("setReferralOnly adds/removes only the referral condition", () => {
        const base = {
            ...mockCampaignDraft.rule,
            conditions: [
                { field: "user.country", operator: "eq" as const, value: "US" },
            ],
        };
        const on = setReferralOnly(base, true);
        expect(getReferralOnly(on)).toBe(true);
        // Unrelated condition preserved.
        expect(on.conditions).toEqual(
            expect.arrayContaining([
                { field: "user.country", operator: "eq", value: "US" },
            ])
        );
        const off = setReferralOnly(on, false);
        expect(getReferralOnly(off)).toBe(false);
        expect(off.conditions).toEqual([
            { field: "user.country", operator: "eq", value: "US" },
        ]);
    });

    test("get/setMinPurchaseAmount round-trips through conditions", () => {
        expect(getMinPurchaseAmount(mockCampaignDraft.rule)).toBe(0);
        const withMin = setMinPurchaseAmount(mockCampaignDraft.rule, 25);
        expect(getMinPurchaseAmount(withMin)).toBe(25);
        // 0 removes the condition.
        const cleared = setMinPurchaseAmount(withMin, 0);
        expect(getMinPurchaseAmount(cleared)).toBe(0);
    });

    test("get/setStartDate round-trips an ISO string", () => {
        expect(getStartDate(mockCampaignDraft.rule)).toBeUndefined();
        const iso = "2024-06-01T00:00:00.000Z";
        const withStart = setStartDate(mockCampaignDraft.rule, iso);
        expect(getStartDate(withStart)).toBe(iso);
        const cleared = setStartDate(withStart, undefined);
        expect(getStartDate(cleared)).toBeUndefined();
    });
});

describe("buildApiPayload", () => {
    test("passes the draft through near-identity", () => {
        const result = buildApiPayload(mockCampaignDraft);

        expect(result.merchantId).toBe(mockCampaignDraft.merchantId);
        expect(result.name).toBe(mockCampaignDraft.name);
        expect(result.rule).toEqual(mockCampaignDraft.rule);
        expect(result.metadata).toEqual(mockCampaignDraft.metadata);
        expect(result.budgetConfig).toEqual(mockCampaignDraft.budgetConfig);
        expect(result.expiresAt).toBe(mockCampaignDraft.expiresAt);
        expect(result.priority).toBe(mockCampaignDraft.priority);
    });

    test("does not send rewardToken as a top-level field", () => {
        const result = buildApiPayload({
            ...mockCampaignDraft,
            rewardToken: "0x1234567890123456789012345678901234567890",
        });
        expect("rewardToken" in result).toBe(false);
    });

    test("does not mutate rule conditions", () => {
        const result = buildApiPayload(mockCampaignDraft);
        expect(result.rule.conditions).toBe(mockCampaignDraft.rule.conditions);
    });
});

describe("campaignToDraft", () => {
    test("should convert campaign to draft", () => {
        const campaign = {
            id: "campaign-123",
            merchantId: "merchant-456",
            name: "Test Campaign",
            rule: {
                trigger: "purchase" as const,
                conditions: [REFERRAL_CONDITION],
                rewards: [
                    {
                        recipient: "referrer" as const,
                        type: "token" as const,
                        amountType: "fixed" as const,
                        amount: 10,
                        token: "0xabcabcabcabcabcabcabcabcabcabcabcabcabca" as const,
                    },
                ],
            },
            metadata: {
                goal: "awareness" as const,
                specialCategories: [],
                territories: ["US"],
            },
            budgetConfig: [
                { label: "Daily", amount: 50, durationInSeconds: 86400 },
            ],
            expiresAt: "2024-12-31T23:59:59.000Z",
            priority: 1,
        };

        const result = campaignToDraft(campaign);

        expect(result.id).toBe("campaign-123");
        expect(result.merchantId).toBe("merchant-456");
        expect(result.name).toBe("Test Campaign");
        expect(result.rule).toEqual(campaign.rule);
        expect(result.metadata).toEqual(campaign.metadata);
        expect(result.budgetConfig).toEqual(campaign.budgetConfig);
        expect(result.expiresAt).toBe("2024-12-31T23:59:59.000Z");
        expect(result.priority).toBe(1);
        // rewardToken derived from the first reward carrying a token.
        expect(result.rewardToken).toBe(
            "0xabcabcabcabcabcabcabcabcabcabcabcabcabca"
        );
    });

    test("should handle null metadata/budget/expiresAt", () => {
        const campaign = {
            id: "campaign-123",
            merchantId: "merchant-456",
            name: "Test Campaign",
            rule: {
                trigger: "purchase" as const,
                conditions: [],
                rewards: [],
            },
            metadata: null,
            budgetConfig: null,
            expiresAt: null,
            priority: 0,
        };

        const result = campaignToDraft(campaign);

        expect(result.metadata).toEqual({
            goal: undefined,
            specialCategories: [],
            territories: [],
        });
        expect(result.budgetConfig).toEqual([]);
        expect(result.expiresAt).toBeUndefined();
        expect(result.rewardToken).toBeUndefined();
    });
});
