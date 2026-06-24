import { describe, expect, it } from "vitest";
import type { InteractionTypeKey } from "../constants/interactionTypes";
import type { EstimatedReward, MerchantReward, RuleConditions } from "../types";
import {
    formatBestReward,
    selectBestReward,
    selectDisplayCampaign,
} from "./select";

const NOW = new Date("2025-01-15T00:00:00Z");
const unix = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

function fixedReward(eur: number): EstimatedReward {
    return {
        payoutType: "fixed",
        amount: { amount: eur, eurAmount: eur, usdAmount: eur, gbpAmount: eur },
    };
}

function uncappedPercentage(percent: number): EstimatedReward {
    return { payoutType: "percentage", percent, percentOf: "purchase_amount" };
}

function startsAtCondition(iso: string): RuleConditions {
    return [{ field: "time.timestamp", operator: "gte", value: unix(iso) }];
}

function campaign(opts: {
    id: string;
    interactionTypeKey?: InteractionTypeKey;
    referrer?: EstimatedReward;
    referee?: EstimatedReward;
    conditions?: RuleConditions;
    expiresAt?: string | null;
    defaultLockupSeconds?: number;
}): MerchantReward {
    return {
        campaignId: opts.id,
        name: opts.id,
        interactionTypeKey: opts.interactionTypeKey ?? "purchase",
        conditions: opts.conditions ?? [],
        referrer: opts.referrer,
        referee: opts.referee,
        expiresAt: opts.expiresAt,
        defaultLockupSeconds: opts.defaultLockupSeconds,
    };
}

describe("selectDisplayCampaign", () => {
    it("returns undefined for an empty set", () => {
        expect(selectDisplayCampaign([], { now: NOW })).toBeUndefined();
    });

    it("picks the highest-reward live campaign", () => {
        const result = selectDisplayCampaign(
            [
                campaign({ id: "low", referrer: fixedReward(2) }),
                campaign({ id: "high", referrer: fixedReward(9) }),
            ],
            { now: NOW }
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
                    conditions: startsAtCondition("2025-03-01T00:00:00Z"),
                }),
                campaign({ id: "live-poor", referrer: fixedReward(3) }),
            ],
            { now: NOW }
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
                    conditions: startsAtCondition("2025-04-01T00:00:00Z"),
                }),
                campaign({
                    id: "sooner",
                    referrer: fixedReward(5),
                    conditions: startsAtCondition("2025-02-01T00:00:00Z"),
                }),
            ],
            { now: NOW }
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
            { now: NOW }
        );
        expect(result?.campaign.campaignId).toBe("active");
    });

    it("only considers campaigns matching targetInteraction", () => {
        const result = selectDisplayCampaign(
            [
                campaign({
                    id: "referral-rich",
                    interactionTypeKey: "referral",
                    referrer: fixedReward(50),
                }),
                campaign({
                    id: "purchase-poor",
                    interactionTypeKey: "purchase",
                    referrer: fixedReward(4),
                }),
            ],
            { now: NOW, targetInteraction: "purchase" }
        );
        expect(result?.campaign.campaignId).toBe("purchase-poor");
    });

    it("ranks by the referee side when audience is 'referee'", () => {
        const rewards = [
            campaign({
                id: "rich-referrer",
                referrer: fixedReward(50),
                referee: fixedReward(2),
            }),
            campaign({
                id: "rich-referee",
                referrer: fixedReward(1),
                referee: fixedReward(9),
            }),
        ];
        expect(
            selectDisplayCampaign(rewards, { now: NOW })?.campaign.campaignId
        ).toBe("rich-referrer");
        expect(
            selectDisplayCampaign(rewards, { now: NOW, audience: "referee" })
                ?.campaign.campaignId
        ).toBe("rich-referee");
    });
});

describe("formatBestReward", () => {
    it("returns undefined for an empty set", () => {
        expect(formatBestReward([], { now: NOW })).toBeUndefined();
    });

    it("formats the selected campaign's referrer reward by default", () => {
        const formatted = formatBestReward(
            [
                campaign({ id: "low", referrer: fixedReward(2) }),
                campaign({ id: "high", referrer: fixedReward(50) }),
            ],
            { now: NOW }
        );
        expect(formatted).toContain("50");
    });

    it("formats the referee reward when audience is 'referee'", () => {
        const formatted = formatBestReward(
            [
                campaign({
                    id: "c",
                    referrer: fixedReward(50),
                    referee: fixedReward(3),
                }),
            ],
            { now: NOW, audience: "referee" }
        );
        expect(formatted).toContain("3");
        expect(formatted).not.toContain("50");
    });

    it("ignores expired campaigns (does not advertise a stale reward)", () => {
        expect(
            formatBestReward(
                [
                    campaign({
                        id: "expired",
                        referrer: fixedReward(99),
                        expiresAt: "2025-01-01T00:00:00Z",
                    }),
                ],
                { now: NOW }
            )
        ).toBeUndefined();
    });

    it("renders an uncapped percentage reward as a percent string", () => {
        expect(
            formatBestReward(
                [campaign({ id: "c", referrer: uncappedPercentage(10) })],
                { now: NOW }
            )
        ).toBe("10 %");
    });
});

describe("selectBestReward", () => {
    it("returns undefined for an empty set", () => {
        expect(selectBestReward([], { now: NOW })).toBeUndefined();
    });

    it("exposes the formatted reward and its payout type", () => {
        const best = selectBestReward(
            [campaign({ id: "c", referrer: fixedReward(50) })],
            { now: NOW }
        );
        expect(best?.formatted).toContain("50");
        expect(best?.payoutType).toBe("fixed");
        expect(best?.minPurchaseAmount).toBeUndefined();
        expect(best?.lockupDurationDays).toBeUndefined();
    });

    it("surfaces the minimum purchase amount when the campaign gates on one", () => {
        const best = selectBestReward(
            [
                campaign({
                    id: "c",
                    referrer: fixedReward(50),
                    conditions: [
                        {
                            field: "purchase.amount",
                            operator: "gte",
                            value: 25,
                        },
                    ],
                }),
            ],
            { now: NOW }
        );
        expect(best?.minPurchaseAmount).toContain("25");
    });

    it("surfaces the lockup duration in whole days", () => {
        const best = selectBestReward(
            [
                campaign({
                    id: "c",
                    referrer: fixedReward(50),
                    defaultLockupSeconds: 7 * 86_400,
                }),
            ],
            { now: NOW }
        );
        expect(best?.lockupDurationDays).toBe(7);
    });

    it("omits a zero lockup", () => {
        const best = selectBestReward(
            [
                campaign({
                    id: "c",
                    referrer: fixedReward(50),
                    defaultLockupSeconds: 0,
                }),
            ],
            { now: NOW }
        );
        expect(best?.lockupDurationDays).toBeUndefined();
    });
});
