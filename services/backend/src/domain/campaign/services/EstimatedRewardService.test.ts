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
