import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import type { CampaignDraft } from "./campaignStore";
import {
    buildApiPayload,
    buildScheduleConditions,
    campaignToDraft,
} from "./campaignStore";

const mockCampaignDraft: CampaignDraft = {
    merchantId: "mock-merchant-id",
    name: "Test Campaign",
    rule: {
        trigger: "purchase",
        conditions: [],
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
    scheduled: {
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-12-31"),
    },
    priority: 0,
    referralOnly: true,
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

            const stored = localStorage.getItem("campaign-draft-v4");
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

        test("should set isSuccess to false", ({
            freshCampaignStore,
        }: TestContext) => {
            freshCampaignStore.getState().setSuccess(true);
            freshCampaignStore.getState().setSuccess(false);

            expect(freshCampaignStore.getState().isSuccess).toBe(false);
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

        test("should reset persisted state", ({
            freshCampaignStore,
        }: TestContext) => {
            freshCampaignStore.getState().setDraft(mockCampaignDraft);
            freshCampaignStore.getState().reset();

            const stored = localStorage.getItem("campaign-draft-v4");
            expect(stored).toBeTruthy();
        });
    });

    describe("persistence", () => {
        test("should persist draft", ({ freshCampaignStore }: TestContext) => {
            freshCampaignStore.getState().setDraft(mockCampaignDraft);

            const stored = localStorage.getItem("campaign-draft-v4");
            expect(stored).toBeTruthy();

            const parsed = JSON.parse(stored || "{}");
            expect(parsed.state.draft).toBeDefined();
        });

        test("should not persist isSuccess", ({
            freshCampaignStore,
        }: TestContext) => {
            freshCampaignStore.getState().setSuccess(true);

            const stored = localStorage.getItem("campaign-draft-v4");
            if (stored) {
                const parsed = JSON.parse(stored);
                expect(parsed.state.isSuccess).toBeUndefined();
            }
        });
    });
});

describe("buildScheduleConditions", () => {
    test("should return empty array when no dates", () => {
        const result = buildScheduleConditions({});
        expect(result).toEqual([]);
    });

    test("should add gte condition for startDate", () => {
        const startDate = new Date("2024-01-01T00:00:00Z");
        const result = buildScheduleConditions({ startDate });

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            field: "time.timestamp",
            operator: "gte",
            value: Math.floor(startDate.getTime() / 1000),
        });
    });

    test("should add lte condition for endDate", () => {
        const endDate = new Date("2024-12-31T23:59:59Z");
        const result = buildScheduleConditions({ endDate });

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            field: "time.timestamp",
            operator: "lte",
            value: Math.floor(endDate.getTime() / 1000),
        });
    });

    test("should add both conditions when both dates provided", () => {
        const startDate = new Date("2024-01-01T00:00:00Z");
        const endDate = new Date("2024-12-31T23:59:59Z");
        const result = buildScheduleConditions({ startDate, endDate });

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
            field: "time.timestamp",
            operator: "gte",
            value: Math.floor(startDate.getTime() / 1000),
        });
        expect(result[1]).toEqual({
            field: "time.timestamp",
            operator: "lte",
            value: Math.floor(endDate.getTime() / 1000),
        });
    });
});

describe("buildApiPayload", () => {
    test("should convert draft to API payload", () => {
        const result = buildApiPayload(mockCampaignDraft);

        expect(result.merchantId).toBe(mockCampaignDraft.merchantId);
        expect(result.name).toBe(mockCampaignDraft.name);
        expect(result.metadata).toEqual(mockCampaignDraft.metadata);
        expect(result.budgetConfig).toEqual(mockCampaignDraft.budgetConfig);
        expect(result.priority).toBe(mockCampaignDraft.priority);
    });

    test("should include schedule conditions in rule.conditions", () => {
        const result = buildApiPayload(mockCampaignDraft);

        expect(result.rule.conditions).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    field: "time.timestamp",
                    operator: "gte",
                }),
                expect.objectContaining({
                    field: "time.timestamp",
                    operator: "lte",
                }),
            ])
        );
    });
    test("should set expiresAt from endDate", () => {
        const result = buildApiPayload(mockCampaignDraft);
        expect(result.expiresAt).toBe(
            mockCampaignDraft.scheduled.endDate?.toISOString()
        );
    });
    test("should preserve existing non-timestamp conditions", () => {
        const draftWithConditions: CampaignDraft = {
            ...mockCampaignDraft,
            rule: {
                ...mockCampaignDraft.rule,
                conditions: [
                    { field: "user.country", operator: "eq", value: "US" },
                ],
            },
        };

        const result = buildApiPayload(draftWithConditions);

        expect(result.rule.conditions).toEqual(
            expect.arrayContaining([
                { field: "user.country", operator: "eq", value: "US" },
            ])
        );
    });

    test("should always include rule in payload (validation handled by save hook)", () => {
        const draftWithEmptyRewards: CampaignDraft = {
            ...mockCampaignDraft,
            id: "existing-campaign-id",
            rule: {
                ...mockCampaignDraft.rule,
                rewards: [],
            },
        };

        const result = buildApiPayload(draftWithEmptyRewards);

        expect(result.rule).toBeDefined();
        expect(result.rule.rewards).toEqual([]);
    });
});

test("should include referral condition when referralOnly is true", () => {
    const draft = { ...mockCampaignDraft, referralOnly: true };
    const result = buildApiPayload(draft);
    expect(result.rule.conditions).toEqual(
        expect.arrayContaining([
            expect.objectContaining({
                field: "attribution.referrerIdentityGroupId",
                operator: "exists",
            }),
        ])
    );
});

test("should not include referral condition when referralOnly is false", () => {
    const draft = { ...mockCampaignDraft, referralOnly: false };
    const result = buildApiPayload(draft);
    const hasReferralCondition = (
        result.rule.conditions as Array<{ field: string }>
    ).some((c) => c.field === "attribution.referrerIdentityGroupId");
    expect(hasReferralCondition).toBe(false);
});
describe("campaignToDraft", () => {
    test("should convert campaign to draft", () => {
        const campaign = {
            id: "campaign-123",
            merchantId: "merchant-456",
            name: "Test Campaign",
            rule: {
                trigger: "purchase" as const,
                conditions: [],
                rewards: [
                    {
                        recipient: "referrer" as const,
                        type: "token" as const,
                        amountType: "fixed" as const,
                        amount: 10,
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
        expect(result.scheduled.endDate).toEqual(
            new Date("2024-12-31T23:59:59.000Z")
        );
        expect(result.priority).toBe(1);
    });

    test("should handle null metadata", () => {
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
        expect(result.scheduled.endDate).toBeUndefined();
    });
});

test("should detect referralOnly from conditions", () => {
    const campaign = {
        id: "campaign-123",
        merchantId: "merchant-456",
        name: "Test Campaign",
        rule: {
            trigger: "purchase" as const,
            conditions: [
                {
                    field: "attribution.referrerIdentityGroupId",
                    operator: "exists" as const,
                    value: true,
                },
            ],
            rewards: [],
        },
        metadata: null,
        budgetConfig: null,
        expiresAt: null,
        priority: 0,
    };
    const result = campaignToDraft(campaign);
    expect(result.referralOnly).toBe(true);
});

test("should set referralOnly to false when condition is absent", () => {
    const campaign = {
        id: "campaign-123",
        merchantId: "merchant-456",
        name: "Test Campaign",
        rule: {
            trigger: "purchase" as const,
            conditions: [
                {
                    field: "user.country",
                    operator: "eq" as const,
                    value: "US",
                },
            ],
            rewards: [],
        },
        metadata: null,
        budgetConfig: null,
        expiresAt: null,
        priority: 0,
    };
    const result = campaignToDraft(campaign);
    expect(result.referralOnly).toBe(false);
});

test("should default referralOnly to true for empty conditions", () => {
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
    expect(result.referralOnly).toBe(true);
});
