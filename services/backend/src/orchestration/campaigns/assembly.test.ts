import { getAddress, zeroAddress } from "viem";
import { describe, expect, it } from "vitest";
import { PLATFORM_FEE_PCT } from "../../domain/campaign";
import {
    buildDetailsResponse,
    buildStatsItem,
    type CampaignDetailsAggregates,
    type CampaignStatsAggregates,
    normaliseWallet,
    pickGranularity,
    surfaceCampaignStatus,
    toIsoString,
} from "./assembly";

const baseStats: CampaignStatsAggregates = {
    campaignId: "c1",
    tokenAddress: null,
    referredInteractions: 0,
    purchaseInteractions: 0,
    createReferralLinkInteractions: 0,
    totalRewards: 0,
    attributedRevenue: 0,
    ambassadors: 0,
};

describe("buildStatsItem", () => {
    it("passes the ambassador count straight through (no derivation)", () => {
        const item = buildStatsItem({ ...baseStats, ambassadors: 7 });
        expect(item.ambassador).toBe(7);
    });

    it("computes derived ratios", () => {
        const item = buildStatsItem({
            ...baseStats,
            referredInteractions: 20,
            purchaseInteractions: 4,
            createReferralLinkInteractions: 10,
            totalRewards: 100,
            attributedRevenue: 200,
            ambassadors: 5,
        });

        expect(item.avgBasketValue).toBe(50); // 200 / 4
        expect(item.sharingRate).toBe(0.5); // 10 / 20
        expect(item.ctr).toBe(2); // 20 / 10
        expect(item.costPerPurchase).toBe(25); // 100 / 4
        expect(item.costPerShare).toBe(10); // 100 / 10
    });

    it("guards every ratio against a zero denominator", () => {
        const item = buildStatsItem(baseStats);
        expect(item.avgBasketValue).toBe(0);
        expect(item.sharingRate).toBe(0);
        expect(item.ctr).toBe(0);
        expect(item.costPerPurchase).toBe(0);
        expect(item.costPerShare).toBe(0);
    });
});

const baseDetails: CampaignDetailsAggregates = {
    currency: "EUR",
    spend: 100,
    ambassadorAmount: 60,
    refereeAmount: 20,
    conversions: 10,
    ambassadorsTotal: 5,
    attributedGMV: 500,
    leaderboard: [],
    leaderboardTotalRevenue: 0,
    totalReferees: 40,
    convertedReferees: 8,
    interactingUsers: 10,
};

describe("buildDetailsResponse", () => {
    it("derives the economic value block", () => {
        const res = buildDetailsResponse(baseDetails);

        expect(res.economicValue.cpa).toBe(10); // 100 / 10
        expect(res.economicValue.metaCpa).toBe(83); // EUR benchmark
        expect(res.economicValue.metaEquivalentCost).toBe(830); // 83 * 10
        expect(res.economicValue.savedVsMeta).toBe(730); // 830 - 100
        expect(res.economicValue.avgBasketValue).toBe(50); // 500 / 10
    });

    it("never reports negative savings when the campaign costs more than Meta", () => {
        const res = buildDetailsResponse({
            ...baseDetails,
            spend: 100000,
        });
        expect(res.economicValue.savedVsMeta).toBe(0);
    });

    it("splits CPA into three segments that sum to the total", () => {
        const res = buildDetailsResponse(baseDetails);
        const { segments, total } = res.cpaBreakdown;

        const frak = segments.find((s) => s.key === "frak");
        expect(frak?.pct).toBe(PLATFORM_FEE_PCT);

        const pctSum = segments.reduce((acc, s) => acc + s.pct, 0);
        const amountSum = segments.reduce((acc, s) => acc + s.amount, 0);
        expect(pctSum).toBeCloseTo(1);
        expect(amountSum).toBeCloseTo(total);
    });

    it("splits the recipient share evenly when there is no real spend", () => {
        const res = buildDetailsResponse({
            ...baseDetails,
            spend: 0,
            conversions: 0,
            ambassadorAmount: 0,
            refereeAmount: 0,
        });
        const even = (1 - PLATFORM_FEE_PCT) / 2;
        const segments = Object.fromEntries(
            res.cpaBreakdown.segments.map((s) => [s.key, s.pct])
        );
        expect(segments.ambassador).toBeCloseTo(even);
        expect(segments.referee).toBeCloseTo(even);
    });

    it("falls back to the zero address when the leaderboard is empty", () => {
        const res = buildDetailsResponse(baseDetails);
        expect(res.efficiency.topPerformerWallet).toBe(zeroAddress);
        expect(res.efficiency.topPerformerPct).toBe(0);
    });

    it("ranks the first leaderboard row as top performer", () => {
        const wallet = getAddress("0x000000000000000000000000000000000000dead");
        const res = buildDetailsResponse({
            ...baseDetails,
            leaderboard: [
                { wallet, earned: 10, shares: 2, sales: 1, revenue: 75 },
            ],
            leaderboardTotalRevenue: 100,
        });
        expect(res.efficiency.topPerformerWallet).toBe(wallet);
        expect(res.efficiency.topPerformerPct).toBe(0.75);
    });
});

describe("surfaceCampaignStatus", () => {
    const now = new Date("2026-05-29T00:00:00.000Z");

    it("collapses archived into ended", () => {
        expect(surfaceCampaignStatus("archived", null, now)).toBe("ended");
    });

    it("treats an active-but-expired campaign as ended", () => {
        const expired = new Date("2026-01-01T00:00:00.000Z");
        expect(surfaceCampaignStatus("active", expired, now)).toBe("ended");
    });

    it("passes live states through unchanged", () => {
        expect(surfaceCampaignStatus("active", null, now)).toBe("active");
        expect(surfaceCampaignStatus("paused", null, now)).toBe("paused");
        expect(surfaceCampaignStatus("draft", null, now)).toBe("draft");
    });
});

describe("pickGranularity", () => {
    const DAY = 24 * 60 * 60 * 1000;
    const range = (days: number) => ({
        from: new Date(0),
        to: new Date(days * DAY),
    });

    it("buckets short windows by day", () => {
        expect(pickGranularity(range(30))).toBe("day");
    });

    it("buckets long windows by month at the 60-day threshold", () => {
        expect(pickGranularity(range(60))).toBe("month");
        expect(pickGranularity(range(120))).toBe("month");
    });
});

describe("normaliseWallet", () => {
    it("checksums a valid hex string", () => {
        const addr = "0x000000000000000000000000000000000000dead";
        expect(normaliseWallet(addr)).toBe(getAddress(addr));
    });

    it("decodes a bytea Buffer", () => {
        const buf = Buffer.alloc(20, 0);
        buf[19] = 1;
        expect(normaliseWallet(buf)).toBe(
            getAddress(`0x${buf.toString("hex")}`)
        );
    });

    it("falls back to the zero address on null or garbage", () => {
        expect(normaliseWallet(null)).toBe(zeroAddress);
        expect(normaliseWallet("not-an-address")).toBe(zeroAddress);
    });
});

describe("toIsoString", () => {
    it("normalises a Date to ISO", () => {
        expect(toIsoString(new Date("2026-05-29T12:00:00.000Z"))).toBe(
            "2026-05-29T12:00:00.000Z"
        );
    });

    it("normalises a raw timestamp string to ISO", () => {
        expect(toIsoString("2026-05-29T12:00:00.000Z")).toBe(
            "2026-05-29T12:00:00.000Z"
        );
    });
});
