import { describe, expect, it, vi } from "vitest";
import type { CampaignRuleSelect } from "../db/schema";
import type { CampaignRuleRepository } from "../repositories/CampaignRuleRepository";
import type { CampaignRuleDefinition } from "../schemas";
import { EstimatedRewardService } from "./EstimatedRewardService";

vi.mock("@backend-infrastructure", () => ({
    pricingRepository: {
        getTokenPrice: vi.fn().mockResolvedValue(null),
    },
}));

function campaignWithRule(rule: CampaignRuleDefinition): CampaignRuleSelect {
    return {
        id: "campaign-1",
        merchantId: "merchant-1",
        name: "Test Campaign",
        status: "active",
        priority: 0,
        rule,
        metadata: null,
        budgetConfig: null,
        budgetUsed: {},
        expiresAt: null,
        publishedAt: new Date(),
        deactivatedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    } as CampaignRuleSelect;
}

function serviceWith(campaigns: CampaignRuleSelect[]) {
    const repository = {
        findActiveByMerchant: vi.fn().mockResolvedValue(campaigns),
    } as unknown as CampaignRuleRepository;
    return new EstimatedRewardService(repository);
}

describe("EstimatedRewardService.getEstimatedRewards — productScope", () => {
    it("round-trips productScope into the estimated item", async () => {
        const productScope: CampaignRuleDefinition["productScope"] = [
            { field: "productId", operator: "eq", value: "A" },
        ];
        const rule: CampaignRuleDefinition = {
            trigger: "purchase",
            conditions: [],
            productScope,
            rewards: [
                {
                    recipient: "referee",
                    type: "token",
                    amountType: "fixed",
                    amount: 10,
                },
            ],
        };

        const service = serviceWith([campaignWithRule(rule)]);
        const result = await service.getEstimatedRewards("merchant-1");

        expect(result.rewards).toHaveLength(1);
        expect(result.rewards[0].productScope).toEqual(productScope);
    });

    it("omits productScope from the estimated item when the rule has none", async () => {
        const rule: CampaignRuleDefinition = {
            trigger: "purchase",
            conditions: [],
            rewards: [
                {
                    recipient: "referee",
                    type: "token",
                    amountType: "fixed",
                    amount: 10,
                },
            ],
        };

        const service = serviceWith([campaignWithRule(rule)]);
        const result = await service.getEstimatedRewards("merchant-1");

        expect(result.rewards[0].productScope).toBeUndefined();
    });

    it("surfaces percentOf matched_items_amount as-is (no cart context at estimate time)", async () => {
        const rule: CampaignRuleDefinition = {
            trigger: "purchase",
            conditions: [],
            productScope: [{ field: "productId", operator: "eq", value: "A" }],
            rewards: [
                {
                    recipient: "referee",
                    type: "token",
                    amountType: "percentage",
                    percent: 10,
                    percentOf: "matched_items_amount",
                },
            ],
        };

        const service = serviceWith([campaignWithRule(rule)]);
        const result = await service.getEstimatedRewards("merchant-1");

        const referee = result.rewards[0].referee;
        expect(referee?.payoutType).toBe("percentage");
        if (referee?.payoutType === "percentage") {
            expect(referee.percentOf).toBe("matched_items_amount");
        }
    });

    it("keeps a zero maxAmount cap instead of dropping it as falsy", async () => {
        const rule: CampaignRuleDefinition = {
            trigger: "purchase",
            conditions: [],
            rewards: [
                {
                    recipient: "referee",
                    type: "token",
                    amountType: "percentage",
                    percent: 10,
                    percentOf: "purchase_amount",
                    maxAmount: 0,
                    minAmount: 0,
                },
            ],
        };

        const service = serviceWith([campaignWithRule(rule)]);
        const result = await service.getEstimatedRewards("merchant-1");

        const referee = result.rewards[0].referee;
        expect(referee?.payoutType).toBe("percentage");
        if (referee?.payoutType !== "percentage") return;
        expect(referee.maxAmount?.amount).toBe(0);
        expect(referee.minAmount?.amount).toBe(0);
    });
});

describe("EstimatedRewardService.getEstimatedRewards — subscriptions", () => {
    const planRule: CampaignRuleDefinition = {
        trigger: "purchase",
        conditions: [],
        subscription: { inactivityDays: 45 },
        rewards: [
            {
                recipient: "referrer",
                type: "token",
                amountType: "fixed",
                amount: 10,
                cycles: { from: 1, to: 1 },
            },
            {
                recipient: "referrer",
                type: "token",
                amountType: "fixed",
                amount: 5,
                cycles: { from: 2, to: 5 },
            },
            {
                recipient: "referee",
                type: "token",
                amountType: "percentage",
                percent: 10,
                percentOf: "purchase_amount",
                cycles: { from: 1, to: 5 },
            },
        ],
    };

    it("splits a plan into the first payment and the later step ranges", async () => {
        const { rewards } = await serviceWith([
            campaignWithRule(planRule),
        ]).getEstimatedRewards("merchant-1");

        expect(rewards[0]?.subscription).toMatchObject({
            steps: [
                {
                    from: 1,
                    to: 1,
                    referrer: { payoutType: "fixed", amount: { amount: 10 } },
                    referee: { payoutType: "percentage", percent: 10 },
                },
                {
                    from: 2,
                    to: 5,
                    referrer: { payoutType: "fixed", amount: { amount: 5 } },
                    referee: { payoutType: "percentage", percent: 10 },
                },
            ],
        });
    });

    it("cuts a range wherever either side changes reward", async () => {
        const { rewards } = await serviceWith([
            campaignWithRule({
                ...planRule,
                rewards: [
                    ...planRule.rewards.slice(0, 2),
                    {
                        recipient: "referee",
                        type: "token",
                        amountType: "fixed",
                        amount: 2,
                        cycles: { from: 4, to: 8 },
                    },
                ],
            }),
        ]).getEstimatedRewards("merchant-1");

        const steps = rewards[0]?.subscription?.steps ?? [];
        expect(steps.map(({ from, to }) => [from, to])).toEqual([
            [1, 1],
            [2, 3],
            [4, 5],
            [6, 8],
        ]);
        expect(steps[2]?.referee).toMatchObject({ amount: { amount: 2 } });
        expect(steps[3]?.referrer).toBeUndefined();
    });

    it("keeps the first payment on the item for readers unaware of subscriptions", async () => {
        const { rewards } = await serviceWith([
            campaignWithRule(planRule),
        ]).getEstimatedRewards("merchant-1");

        expect(rewards[0]?.referrer).toMatchObject({
            payoutType: "fixed",
            amount: { amount: 10 },
        });
        expect(rewards[0]?.referee).toMatchObject({ payoutType: "percentage" });
    });

    it("reads a plan without a mode as counting cycles", async () => {
        const { rewards } = await serviceWith([
            campaignWithRule(planRule),
        ]).getEstimatedRewards("merchant-1");

        expect(rewards[0]?.subscription?.stepBy).toBe("cycle");
    });

    it("turns the percentage of an amount step into its exact amount", async () => {
        const { rewards } = await serviceWith([
            campaignWithRule({
                ...planRule,
                subscription: { stepBy: "amount", stepAmount: 40 },
            }),
        ]).getEstimatedRewards("merchant-1");

        expect(rewards[0]?.subscription).toMatchObject({
            stepBy: "amount",
            steps: [
                { referee: { payoutType: "percentage", percent: 10 } },
                {
                    referrer: { payoutType: "fixed", amount: { amount: 5 } },
                    referee: { payoutType: "fixed", amount: { amount: 4 } },
                },
            ],
        });
    });

    it("exposes a duration plan's mode", async () => {
        const { rewards } = await serviceWith([
            campaignWithRule({
                ...planRule,
                rewards: planRule.rewards.slice(0, 2),
                subscription: { stepBy: "duration", stepDays: 30 },
            }),
        ]).getEstimatedRewards("merchant-1");

        expect(rewards[0]?.subscription).toMatchObject({
            stepBy: "duration",
            steps: [
                { from: 1, to: 1 },
                { from: 2, to: 5 },
            ],
        });
    });

    it("leaves a regular campaign without a subscription block", async () => {
        const { rewards } = await serviceWith([
            campaignWithRule({
                trigger: "purchase",
                conditions: [],
                rewards: [
                    {
                        recipient: "referee",
                        type: "token",
                        amountType: "fixed",
                        amount: 10,
                    },
                ],
            }),
        ]).getEstimatedRewards("merchant-1");

        expect(rewards[0]?.subscription).toBeUndefined();
    });
});
