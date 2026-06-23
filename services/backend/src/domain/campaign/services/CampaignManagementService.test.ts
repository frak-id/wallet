import { describe, expect, it, vi } from "vitest";
import type { CampaignRuleSelect } from "../db/schema";
import type { CampaignRuleRepository } from "../repositories/CampaignRuleRepository";
import type { CampaignRuleDefinition, RewardTier } from "../schemas";
import { CampaignManagementService } from "./CampaignManagementService";

const draftCampaign = {
    id: "campaign-1",
    status: "draft",
} as CampaignRuleSelect;

function serviceWithDraft() {
    const repository = {
        findById: vi.fn().mockResolvedValue(draftCampaign),
        update: vi.fn().mockResolvedValue(draftCampaign),
    } as unknown as CampaignRuleRepository;
    return new CampaignManagementService(repository);
}

function tieredRule(tiers: RewardTier[]): CampaignRuleDefinition {
    return {
        trigger: "purchase",
        conditions: [],
        rewards: [
            {
                recipient: "referee",
                type: "token",
                amountType: "tiered",
                tierField: "purchase.amount",
                tiers,
            },
        ],
    };
}

async function updateWithTiers(tiers: RewardTier[]) {
    return serviceWithDraft().update("campaign-1", {
        rule: tieredRule(tiers),
    });
}

describe("CampaignManagementService tier validation", () => {
    it("accepts contiguous flat and percent tiers", async () => {
        await expect(
            updateWithTiers([
                { minValue: 0, maxValue: 100, amount: 3 },
                { minValue: 100, percent: 5 },
            ])
        ).resolves.toBeDefined();
    });

    it("rejects a tier carrying both amount and percent", async () => {
        await expect(
            updateWithTiers([
                { minValue: 0, amount: 3, percent: 5 } as RewardTier,
            ])
        ).rejects.toThrow("exactly one of amount or percent");
    });

    it("rejects non-positive amounts", async () => {
        await expect(
            updateWithTiers([{ minValue: 0, amount: 0 }])
        ).rejects.toThrow("Tier amount must be positive");
    });

    it("rejects percent outside (0, 100]", async () => {
        await expect(
            updateWithTiers([{ minValue: 0, percent: 101 }])
        ).rejects.toThrow("Tier percent must be between 0 and 100");
    });

    it("rejects percent tiers on non purchase.amount fields", async () => {
        const rule = tieredRule([{ minValue: 0, percent: 5 }]);
        const reward = rule.rewards[0];
        if (reward.amountType === "tiered") {
            reward.tierField = "user.totalPurchases";
        }
        await expect(
            serviceWithDraft().update("campaign-1", { rule })
        ).rejects.toThrow("Percent tiers require tierField purchase.amount");
    });

    it("rejects inverted ranges", async () => {
        await expect(
            updateWithTiers([{ minValue: 100, maxValue: 50, amount: 3 }])
        ).rejects.toThrow("minValue must be lower than maxValue");
    });

    it("rejects overlapping ranges", async () => {
        await expect(
            updateWithTiers([
                { minValue: 0, maxValue: 200, amount: 3 },
                { minValue: 100, percent: 5 },
            ])
        ).rejects.toThrow("must not overlap");
    });

    it("rejects a non-final open-ended tier", async () => {
        await expect(
            updateWithTiers([
                { minValue: 0, amount: 3 },
                { minValue: 100, percent: 5 },
            ])
        ).rejects.toThrow("must not overlap");
    });
});
