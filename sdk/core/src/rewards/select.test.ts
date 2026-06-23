import { describe, expect, it } from "vitest";
import type { EstimatedReward, MerchantReward, RuleConditions } from "../types";
import { selectDisplayCampaign } from "./select";

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
}): MerchantReward {
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
