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

        expect(update).toHaveBeenCalledWith(
            "campaign-1",
            {
                rule: expect.objectContaining({
                    conditions: [
                        {
                            field: "time.timestamp",
                            operator: "gte",
                            value: START_UNIX,
                        },
                    ],
                }),
            },
            // TOCTOU guard: the write re-checks the status the service read.
            ["active"]
        );
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

    it("accepts tierField purchase.matchedAmount for percent tiers (relaxed guard)", async () => {
        const rule = productScopedRule({
            trigger: "purchase",
            rewards: [
                {
                    recipient: "referee",
                    type: "token",
                    amountType: "tiered",
                    tierField: "purchase.matchedAmount",
                    tiers: [{ minValue: 0, percent: 5 }],
                },
            ],
        });
        await expect(
            serviceWithDraft().update("campaign-1", { rule })
        ).resolves.toBeDefined();
    });
});

function productScopedRule(
    overrides: Partial<CampaignRuleDefinition> = {}
): CampaignRuleDefinition {
    return {
        trigger: "purchase",
        conditions: [],
        productScope: [{ field: "productId", operator: "eq", value: "A" }],
        rewards: [
            {
                recipient: "referee",
                type: "token",
                amountType: "fixed",
                amount: 10,
            },
        ],
        ...overrides,
    };
}

describe("CampaignManagementService productScope validation", () => {
    it("accepts a well-formed productScope", async () => {
        await expect(
            serviceWithDraft().update("campaign-1", {
                rule: productScopedRule(),
            })
        ).resolves.toBeDefined();
    });

    it("rejects an unknown field", async () => {
        const rule = productScopedRule({
            productScope: [
                { field: "category", operator: "eq", value: "shoes" },
            ],
        });
        await expect(
            serviceWithDraft().update("campaign-1", { rule })
        ).rejects.toThrow("is not allowed");
    });

    it("rejects 'in' with a scalar value", async () => {
        const rule = productScopedRule({
            productScope: [
                { field: "productId", operator: "in", value: "A" as never },
            ],
        });
        await expect(
            serviceWithDraft().update("campaign-1", { rule })
        ).rejects.toThrow("requires an array value");
    });

    it("rejects an array value on 'eq' (always-false failure mode)", async () => {
        const rule = productScopedRule({
            productScope: [
                {
                    field: "productId",
                    operator: "eq",
                    value: ["A", "B"] as never,
                },
            ],
        });
        await expect(
            serviceWithDraft().update("campaign-1", { rule })
        ).rejects.toThrow("cannot use an array value");
    });

    it("rejects an array value on 'between'/'gt' (lexicographic-coercion failure mode)", async () => {
        const rule = productScopedRule({
            productScope: [
                {
                    field: "unitPrice",
                    operator: "gt",
                    value: [1, 2] as never,
                },
            ],
        });
        await expect(
            serviceWithDraft().update("campaign-1", { rule })
        ).rejects.toThrow("cannot use an array value");
    });

    it("rejects an empty 'in' array", async () => {
        const rule = productScopedRule({
            productScope: [{ field: "productId", operator: "in", value: [] }],
        });
        await expect(
            serviceWithDraft().update("campaign-1", { rule })
        ).rejects.toThrow("cannot use an empty array");
    });

    it("rejects an empty 'not_in' array", async () => {
        const rule = productScopedRule({
            productScope: [
                { field: "productId", operator: "not_in", value: [] },
            ],
        });
        await expect(
            serviceWithDraft().update("campaign-1", { rule })
        ).rejects.toThrow("cannot use an empty array");
    });

    it("rejects a negated scope (not_in) when a reward is fixed (no matched basis)", async () => {
        const rule = productScopedRule({
            productScope: [
                { field: "sku", operator: "not_in", value: ["CHEAP"] },
            ],
        });
        await expect(
            serviceWithDraft().update("campaign-1", { rule })
        ).rejects.toThrow("requires every reward to use a matched-items basis");
    });

    it("rejects a 'neq' scope with a percentOf purchase_amount reward", async () => {
        const rule = productScopedRule({
            productScope: [{ field: "sku", operator: "neq", value: "CHEAP" }],
            rewards: [
                {
                    recipient: "referee",
                    type: "token",
                    amountType: "percentage",
                    percent: 5,
                    percentOf: "purchase_amount",
                },
            ],
        });
        await expect(
            serviceWithDraft().update("campaign-1", { rule })
        ).rejects.toThrow("requires every reward to use a matched-items basis");
    });

    it("rejects a logic 'none' group scope with a fixed reward (conservative detection)", async () => {
        const rule = productScopedRule({
            productScope: {
                logic: "none",
                conditions: [
                    { field: "sku", operator: "in", value: ["CHEAP"] },
                ],
            },
        });
        await expect(
            serviceWithDraft().update("campaign-1", { rule })
        ).rejects.toThrow("requires every reward to use a matched-items basis");
    });

    it("rejects a negated leaf nested inside a positive group with a fixed reward", async () => {
        const rule = productScopedRule({
            productScope: {
                logic: "all",
                conditions: [
                    { field: "name", operator: "starts_with", value: "eco-" },
                    { field: "sku", operator: "not_in", value: ["CHEAP"] },
                ],
            },
        });
        await expect(
            serviceWithDraft().update("campaign-1", { rule })
        ).rejects.toThrow("requires every reward to use a matched-items basis");
    });

    it("accepts a negated scope when every reward uses a matched basis", async () => {
        const rule = productScopedRule({
            productScope: [
                { field: "sku", operator: "not_in", value: ["CHEAP"] },
            ],
            rewards: [
                {
                    recipient: "referee",
                    type: "token",
                    amountType: "percentage",
                    percent: 5,
                    percentOf: "matched_items_amount",
                },
                {
                    recipient: "referrer",
                    type: "token",
                    amountType: "tiered",
                    tierField: "purchase.matchedAmount",
                    tiers: [{ minValue: 0, amount: 5 }],
                },
            ],
        });
        await expect(
            serviceWithDraft().update("campaign-1", { rule })
        ).resolves.toBeDefined();
    });

    it("accepts a positive scope with a fixed reward (guard is negation-only)", async () => {
        const rule = productScopedRule({
            productScope: [
                { field: "sku", operator: "in", value: ["SHOE-42"] },
            ],
        });
        await expect(
            serviceWithDraft().update("campaign-1", { rule })
        ).resolves.toBeDefined();
    });

    it("rejects an array valueTo on 'between'", async () => {
        const rule = productScopedRule({
            productScope: [
                {
                    field: "unitPrice",
                    operator: "between",
                    value: 1,
                    valueTo: [9] as never,
                },
            ],
        });
        await expect(
            serviceWithDraft().update("campaign-1", { rule })
        ).rejects.toThrow("cannot use an array valueTo");
    });

    it("rejects a null value on a string operator ('contains')", async () => {
        const rule = productScopedRule({
            productScope: [{ field: "sku", operator: "contains", value: null }],
        });
        await expect(
            serviceWithDraft().update("campaign-1", { rule })
        ).rejects.toThrow("requires a string value");
    });

    it("rejects a nested-group scope with a bad leaf field (proves recursion)", async () => {
        const rule = productScopedRule({
            productScope: {
                logic: "any",
                conditions: [
                    { field: "productId", operator: "eq", value: "A" },
                    {
                        logic: "all",
                        conditions: [
                            {
                                field: "not-a-real-field",
                                operator: "eq",
                                value: "x",
                            },
                        ],
                    },
                ],
            },
        });
        await expect(
            serviceWithDraft().update("campaign-1", { rule })
        ).rejects.toThrow("is not allowed");
    });

    it("rejects an over-deep nested scope", async () => {
        let deep: CampaignRuleDefinition["productScope"] = {
            field: "productId",
            operator: "eq",
            value: "A",
        };
        for (let i = 0; i < 7; i++) {
            deep = { logic: "all", conditions: [deep as never] };
        }
        const rule = productScopedRule({ productScope: deep });
        await expect(
            serviceWithDraft().update("campaign-1", { rule })
        ).rejects.toThrow("nested too deeply");
    });

    it("rejects productScope on a non-purchase trigger", async () => {
        const rule = productScopedRule({ trigger: "share" as never });
        await expect(
            serviceWithDraft().update("campaign-1", { rule })
        ).rejects.toThrow("only valid on the purchase trigger");
    });

    it("rejects matched_items_amount without a productScope", async () => {
        const rule: CampaignRuleDefinition = {
            trigger: "purchase",
            conditions: [],
            rewards: [
                {
                    recipient: "referee",
                    type: "token",
                    amountType: "percentage",
                    percent: 5,
                    percentOf: "matched_items_amount",
                },
            ],
        };
        await expect(
            serviceWithDraft().update("campaign-1", { rule })
        ).rejects.toThrow("requires a productScope");
    });

    it("rejects tierField purchase.matchedAmount without a productScope", async () => {
        const rule: CampaignRuleDefinition = {
            trigger: "purchase",
            conditions: [],
            rewards: [
                {
                    recipient: "referee",
                    type: "token",
                    amountType: "tiered",
                    tierField: "purchase.matchedAmount",
                    tiers: [{ minValue: 0, amount: 5 }],
                },
            ],
        };
        await expect(
            serviceWithDraft().update("campaign-1", { rule })
        ).rejects.toThrow("requires a productScope");
    });

    it("rejects tierField purchase.matchedQuantity without a productScope", async () => {
        const rule: CampaignRuleDefinition = {
            trigger: "purchase",
            conditions: [],
            rewards: [
                {
                    recipient: "referee",
                    type: "token",
                    amountType: "tiered",
                    tierField: "purchase.matchedQuantity",
                    tiers: [{ minValue: 0, amount: 5 }],
                },
            ],
        };
        await expect(
            serviceWithDraft().update("campaign-1", { rule })
        ).rejects.toThrow("requires a productScope");
    });

    it("applyStartDate preserves an existing productScope", async () => {
        const scope: CampaignRuleDefinition["productScope"] = [
            { field: "productId", operator: "eq", value: "A" },
        ];
        const campaign = {
            id: "campaign-1",
            status: "active",
            publishedAt: null,
            rule: {
                trigger: "purchase",
                conditions: [],
                productScope: scope,
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
        const { service, update } = serviceWith(campaign);

        await service.update("campaign-1", {
            startDate: new Date("2025-06-01T00:00:00Z"),
        });

        const rule = update.mock.calls[0][1].rule as CampaignRuleDefinition;
        expect(rule.productScope).toEqual(scope);
    });
});
