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

function activeCampaign(
    conditions: CampaignRuleDefinition["conditions"],
    publishedAt?: Date
): CampaignRuleSelect {
    return {
        id: "campaign-1",
        status: "active",
        publishedAt: publishedAt ?? null,
        rule: {
            trigger: "purchase",
            conditions,
            rewards: [
                {
                    recipient: "referee",
                    type: "token",
                    amountType: "fixed",
                    amount: 10,
                },
            ],
        },
    } as CampaignRuleSelect;
}

function serviceWith(campaign: CampaignRuleSelect) {
    const update = vi.fn().mockImplementation(async (_id, updates) => ({
        ...campaign,
        ...updates,
    }));
    const repository = {
        findById: vi.fn().mockResolvedValue(campaign),
        update,
    } as unknown as CampaignRuleRepository;
    return {
        service: new CampaignManagementService(repository),
        update,
    };
}

const START = new Date("2025-06-01T00:00:00Z");
const START_UNIX = Math.floor(START.getTime() / 1000);

describe("CampaignManagementService start-date edit", () => {
    it("rejects a full rule change on a published campaign", async () => {
        const { service } = serviceWith(activeCampaign([]));
        await expect(
            service.update("campaign-1", {
                rule: tieredRule([{ minValue: 0, amount: 3 }]),
            })
        ).rejects.toThrow("Cannot modify rule definition after publishing");
    });

    it("sets the start gate on a published campaign", async () => {
        const { service, update } = serviceWith(activeCampaign([]));
        await service.update("campaign-1", { startDate: START });

        expect(update).toHaveBeenCalledWith("campaign-1", {
            rule: expect.objectContaining({
                conditions: [
                    {
                        field: "time.timestamp",
                        operator: "gte",
                        value: START_UNIX,
                    },
                ],
            }),
        });
    });

    it("replaces an existing start gate rather than duplicating it", async () => {
        const { service, update } = serviceWith(
            activeCampaign([
                { field: "time.timestamp", operator: "gte", value: 111 },
                { field: "purchase.amount", operator: "gte", value: 20 },
            ])
        );
        await service.update("campaign-1", { startDate: START });

        const rule = update.mock.calls[0][1].rule as CampaignRuleDefinition;
        const timeConditions = (
            rule.conditions as CampaignRuleDefinition["conditions"] & unknown[]
        ).filter((c) => "field" in c && c.field === "time.timestamp");
        expect(timeConditions).toEqual([
            { field: "time.timestamp", operator: "gte", value: START_UNIX },
        ]);
        // Unrelated conditions survive untouched.
        expect(rule.conditions).toContainEqual({
            field: "purchase.amount",
            operator: "gte",
            value: 20,
        });
    });

    it("rejects moving the start gate backward on a published campaign", async () => {
        const later = Math.floor(START.getTime() / 1000) + 86_400;
        const { service } = serviceWith(
            activeCampaign([
                { field: "time.timestamp", operator: "gte", value: later },
            ])
        );
        await expect(
            service.update("campaign-1", { startDate: START })
        ).rejects.toThrow("can only be moved forward");
    });

    it("allows moving the start gate forward on a published campaign", async () => {
        const earlier = Math.floor(START.getTime() / 1000) - 86_400;
        const { service, update } = serviceWith(
            activeCampaign([
                { field: "time.timestamp", operator: "gte", value: earlier },
            ])
        );
        await service.update("campaign-1", { startDate: START });

        expect(update.mock.calls[0][1].rule).toEqual(
            expect.objectContaining({
                conditions: [
                    {
                        field: "time.timestamp",
                        operator: "gte",
                        value: START_UNIX,
                    },
                ],
            })
        );
    });

    it("rejects a start date before publish when no gate exists", async () => {
        const publishedAt = new Date(START.getTime() + 86_400_000);
        const { service } = serviceWith(activeCampaign([], publishedAt));
        await expect(
            service.update("campaign-1", { startDate: START })
        ).rejects.toThrow("can only be moved forward");
    });

    it("rejects clearing the start gate on a published campaign", async () => {
        const { service } = serviceWith(
            activeCampaign([
                { field: "time.timestamp", operator: "gte", value: 111 },
            ])
        );
        await expect(
            service.update("campaign-1", { startDate: null })
        ).rejects.toThrow("can only be moved forward");
    });

    it("allows clearing the start gate on a draft (no forward restriction)", async () => {
        const draftWithGate = {
            ...activeCampaign([
                { field: "time.timestamp", operator: "gte", value: 111 },
            ]),
            status: "draft",
        } as CampaignRuleSelect;
        const { service, update } = serviceWith(draftWithGate);
        await service.update("campaign-1", { startDate: null });

        expect(update.mock.calls[0][1].rule).toEqual(
            expect.objectContaining({ conditions: [] })
        );
    });
});

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
