import type {
    EstimatedRewardItem,
    RuleConditions,
} from "@frak-labs/backend-elysia/domain/campaign";
import type { EstimatedReward } from "@frak-labs/core-sdk";
import { describe, expect, it } from "vitest";
import {
    extractMinPurchaseAmount,
    extractStartDate,
    getRewardEurValue,
    selectDisplayCampaign,
} from "./campaignDisplay";

const NOW = new Date("2025-01-15T00:00:00Z");
const unix = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

function fixedReward(eur: number): EstimatedReward {
    return {
        payoutType: "fixed",
        amount: { amount: eur, eurAmount: eur, usdAmount: eur, gbpAmount: eur },
    };
}

function campaign(opts: {
    id: string;
    referrer?: EstimatedReward;
    referee?: EstimatedReward;
    conditions?: RuleConditions;
    expiresAt?: string | null;
    defaultLockupSeconds?: number;
}): EstimatedRewardItem {
    return {
        campaignId: opts.id,
        name: opts.id,
        interactionTypeKey: "purchase",
        conditions: opts.conditions ?? [],
        referrer: opts.referrer,
        referee: opts.referee,
        expiresAt: opts.expiresAt,
        defaultLockupSeconds: opts.defaultLockupSeconds,
    };
}

describe("extractMinPurchaseAmount", () => {
    it("reads a flat purchase.amount gte condition", () => {
        expect(
            extractMinPurchaseAmount([
                { field: "purchase.amount", operator: "gte", value: 50 },
            ])
        ).toBe(50);
    });

    it("walks nested groups and keeps the lowest threshold", () => {
        expect(
            extractMinPurchaseAmount({
                logic: "all",
                conditions: [
                    { field: "purchase.amount", operator: "gte", value: 80 },
                    {
                        logic: "any",
                        conditions: [
                            {
                                field: "purchase.amount",
                                operator: "gt",
                                value: 30,
                            },
                        ],
                    },
                ],
            })
        ).toBe(30);
    });

    it("returns undefined without a purchase gate", () => {
        expect(
            extractMinPurchaseAmount([
                { field: "user.isNew", operator: "eq", value: true },
            ])
        ).toBeUndefined();
    });
});

describe("extractStartDate", () => {
    it("reads a time.timestamp gte condition (unix seconds)", () => {
        const start = extractStartDate([
            {
                field: "time.timestamp",
                operator: "gte",
                value: unix("2025-02-01T00:00:00Z"),
            },
        ]);
        expect(start?.toISOString()).toBe("2025-02-01T00:00:00.000Z");
    });

    it("returns undefined without a start gate", () => {
        expect(extractStartDate([])).toBeUndefined();
    });
});

describe("getRewardEurValue", () => {
    it("returns the fixed eur amount", () => {
        expect(getRewardEurValue(fixedReward(5))).toBe(5);
    });

    it("uses maxAmount for a percentage reward", () => {
        expect(
            getRewardEurValue({
                payoutType: "percentage",
                percent: 8,
                percentOf: "purchase_amount",
                maxAmount: {
                    amount: 4.8,
                    eurAmount: 4.8,
                    usdAmount: 5,
                    gbpAmount: 4,
                },
            })
        ).toBe(4.8);
    });
});

describe("selectDisplayCampaign", () => {
    it("returns undefined for an empty set", () => {
        expect(selectDisplayCampaign([], NOW)).toBeUndefined();
    });

    it("picks the highest-reward live campaign", () => {
        const result = selectDisplayCampaign(
            [
                campaign({ id: "low", referrer: fixedReward(2) }),
                campaign({ id: "high", referrer: fixedReward(9) }),
            ],
            NOW
        );
        expect(result?.status).toBe("live");
        expect(result?.campaign.campaignId).toBe("high");
    });

    it("prefers a live campaign over a richer upcoming one", () => {
        const result = selectDisplayCampaign(
            [
                campaign({
                    id: "upcoming-rich",
                    referrer: fixedReward(50),
                    conditions: [
                        {
                            field: "time.timestamp",
                            operator: "gte",
                            value: unix("2025-03-01T00:00:00Z"),
                        },
                    ],
                }),
                campaign({ id: "live-poor", referrer: fixedReward(3) }),
            ],
            NOW
        );
        expect(result?.status).toBe("live");
        expect(result?.campaign.campaignId).toBe("live-poor");
    });

    it("falls back to the soonest-starting upcoming campaign", () => {
        const result = selectDisplayCampaign(
            [
                campaign({
                    id: "later",
                    referrer: fixedReward(50),
                    conditions: [
                        {
                            field: "time.timestamp",
                            operator: "gte",
                            value: unix("2025-04-01T00:00:00Z"),
                        },
                    ],
                }),
                campaign({
                    id: "sooner",
                    referrer: fixedReward(5),
                    conditions: [
                        {
                            field: "time.timestamp",
                            operator: "gte",
                            value: unix("2025-02-01T00:00:00Z"),
                        },
                    ],
                }),
            ],
            NOW
        );
        expect(result?.status).toBe("upcoming");
        expect(result?.campaign.campaignId).toBe("sooner");
        expect(result?.startsAt?.toISOString()).toBe(
            "2025-02-01T00:00:00.000Z"
        );
    });

    it("skips expired campaigns", () => {
        const result = selectDisplayCampaign(
            [
                campaign({
                    id: "expired",
                    referrer: fixedReward(99),
                    expiresAt: "2025-01-01T00:00:00Z",
                }),
                campaign({ id: "active", referrer: fixedReward(4) }),
            ],
            NOW
        );
        expect(result?.campaign.campaignId).toBe("active");
    });
});
