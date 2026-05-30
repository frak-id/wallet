import { type DateRange, safeRatio } from "@backend-utils";
import { type Address, bytesToHex, getAddress, zeroAddress } from "viem";
import {
    type CampaignStatus,
    metaCpaForCurrency,
    PLATFORM_FEE_PCT,
} from "../../domain/campaign";
import type {
    CampaignDetailsResponse,
    CpaSegmentKey,
} from "../schemas/campaignDetailsSchemas";
import type {
    OverviewGranularity,
    OverviewTopCampaign,
} from "../schemas/campaignOverviewSchemas";
import type { CampaignStatsItem } from "../schemas/campaignStatsSchemas";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Switch from daily to monthly bucketing once the window spans this many days. */
const MONTHLY_BUCKET_THRESHOLD_DAYS = 60;

/**
 * Pure data-shaping + derived-ratio math for the campaign reporting
 * endpoints. No I/O, no SQL — the orchestrator hands in already-fetched
 * aggregates and gets the API response shape back.
 *
 * Keeping the math here makes it trivially unit-testable (no db mocks)
 * and lets the orchestrators stay focused on coordinating queries.
 */

// ----------------------------------------------------------------------
//  List item (per-campaign stats row)
// ----------------------------------------------------------------------

export type CampaignStatsAggregates = {
    campaignId: string;
    tokenAddress: Address | null;
    referredInteractions: number;
    purchaseInteractions: number;
    createReferralLinkInteractions: number;
    totalRewards: number;
    attributedRevenue: number;
    /**
     * Distinct identity groups that earned a `referrer` reward on this
     * campaign — the campaign's active ambassadors. Surfaced straight
     * through, no derivation.
     */
    ambassadors: number;
};

export function buildStatsItem(
    agg: CampaignStatsAggregates
): CampaignStatsItem {
    return {
        campaignId: agg.campaignId,
        tokenAddress: agg.tokenAddress,
        referredInteractions: agg.referredInteractions,
        purchaseInteractions: agg.purchaseInteractions,
        createReferralLinkInteractions: agg.createReferralLinkInteractions,
        totalRewards: agg.totalRewards,
        attributedRevenue: agg.attributedRevenue,
        avgBasketValue: safeRatio(
            agg.attributedRevenue,
            agg.purchaseInteractions
        ),
        ambassador: agg.ambassadors,
        sharingRate: safeRatio(
            agg.createReferralLinkInteractions,
            agg.referredInteractions
        ),
        ctr: safeRatio(
            agg.referredInteractions,
            agg.createReferralLinkInteractions
        ),
        costPerPurchase: safeRatio(agg.totalRewards, agg.purchaseInteractions),
        costPerShare: safeRatio(
            agg.totalRewards,
            agg.createReferralLinkInteractions
        ),
    };
}

// ----------------------------------------------------------------------
//  Details response (single campaign deep dive)
// ----------------------------------------------------------------------

export type CampaignDetailsAggregates = {
    currency: string;
    spend: number;
    ambassadorAmount: number;
    refereeAmount: number;
    conversions: number;
    ambassadorsTotal: number;
    attributedGMV: number;
    leaderboard: Array<{
        wallet: Address;
        earned: number;
        shares: number;
        sales: number;
        revenue: number;
    }>;
    leaderboardTotalRevenue: number;
    totalReferees: number;
    convertedReferees: number;
    interactingUsers: number;
};

export function buildDetailsResponse(
    agg: CampaignDetailsAggregates
): CampaignDetailsResponse {
    const cpa = safeRatio(agg.spend, agg.conversions);
    const metaCpa = metaCpaForCurrency(agg.currency);
    const metaEquivalentCost = metaCpa * agg.conversions;
    const savedVsMeta = Math.max(0, metaEquivalentCost - agg.spend);
    const top = agg.leaderboard[0];

    return {
        economicValue: {
            currency: agg.currency,
            spend: agg.spend,
            conversions: agg.conversions,
            cpa,
            attributedGMV: agg.attributedGMV,
            avgBasketValue: safeRatio(agg.attributedGMV, agg.conversions),
            metaEquivalentCost,
            metaCpa,
            savedVsMeta,
            cheaperPct: safeRatio(savedVsMeta, metaEquivalentCost),
        },
        cpaBreakdown: {
            currency: agg.currency,
            total: cpa,
            segments: buildCpaSegments(
                cpa,
                agg.ambassadorAmount,
                agg.refereeAmount
            ),
        },
        ambassadorStats: {
            total: agg.ambassadorsTotal,
            activePct: safeRatio(agg.ambassadorsTotal, agg.interactingUsers),
            refereesConvertedPct: safeRatio(
                agg.convertedReferees,
                agg.totalReferees
            ),
        },
        topAmbassadors: agg.leaderboard,
        efficiency: {
            currency: agg.currency,
            roi: safeRatio(agg.attributedGMV, agg.spend),
            avgReward: safeRatio(agg.spend, agg.ambassadorsTotal),
            topPerformerPct: top
                ? safeRatio(top.revenue, agg.leaderboardTotalRevenue)
                : 0,
            topPerformerWallet: top ? top.wallet : zeroAddress,
        },
    };
}

/**
 * Three-segment CPA breakdown. The Frak platform fee is an overlay
 * (no `platform` recipient_type exists in the schema yet — see
 * `domain/campaign/benchmarks.ts`). We compute `frak = total × fee`
 * and scale the real ambassador/referee amounts so all three segments
 * sum to `total` exactly. When there's no real referrer/referee spend
 * we degrade gracefully: `frak` still appears at the configured fee
 * share, the other two split the remainder evenly.
 */
function buildCpaSegments(
    cpaTotal: number,
    ambassadorAmount: number,
    refereeAmount: number
): Array<{ key: CpaSegmentKey; pct: number; amount: number }> {
    if (cpaTotal === 0) {
        return [
            { key: "frak", pct: PLATFORM_FEE_PCT, amount: 0 },
            { key: "ambassador", pct: (1 - PLATFORM_FEE_PCT) / 2, amount: 0 },
            { key: "referee", pct: (1 - PLATFORM_FEE_PCT) / 2, amount: 0 },
        ];
    }

    const recipientTotal = ambassadorAmount + refereeAmount;
    const ambassadorPct =
        recipientTotal > 0
            ? (1 - PLATFORM_FEE_PCT) * (ambassadorAmount / recipientTotal)
            : (1 - PLATFORM_FEE_PCT) / 2;
    const refereePct =
        recipientTotal > 0
            ? (1 - PLATFORM_FEE_PCT) * (refereeAmount / recipientTotal)
            : (1 - PLATFORM_FEE_PCT) / 2;

    return [
        {
            key: "frak",
            pct: PLATFORM_FEE_PCT,
            amount: cpaTotal * PLATFORM_FEE_PCT,
        },
        {
            key: "ambassador",
            pct: ambassadorPct,
            amount: cpaTotal * ambassadorPct,
        },
        { key: "referee", pct: refereePct, amount: cpaTotal * refereePct },
    ];
}

// ----------------------------------------------------------------------
//  Wallet decoding
// ----------------------------------------------------------------------

/**
 * The `MAX(identity_value::text)` aggregate in the leaderboard query
 * returns the wallet as either a `0x…` hex string or `null`. Some
 * drivers surface it as a `Buffer` when the underlying column is bytea
 * — guard against both shapes.
 */
export function normaliseWallet(value: Buffer | string | null): Address {
    if (!value) return zeroAddress;
    if (typeof value === "string") {
        try {
            return getAddress(value);
        } catch {
            return zeroAddress;
        }
    }
    try {
        return getAddress(bytesToHex(value));
    } catch {
        return zeroAddress;
    }
}

// ----------------------------------------------------------------------
//  Overview helpers
// ----------------------------------------------------------------------

/**
 * Day buckets for short windows, month buckets once the window crosses
 * `MONTHLY_BUCKET_THRESHOLD_DAYS` — keeps the chart readable instead of
 * collapsing into a single bar on long ranges.
 */
export function pickGranularity(range: DateRange): OverviewGranularity {
    const days = (range.to.getTime() - range.from.getTime()) / DAY_MS;
    return days >= MONTHLY_BUCKET_THRESHOLD_DAYS ? "month" : "day";
}

/**
 * Collapse the domain `CampaignStatus` enum into the four-state FE
 * vocabulary. `archived` and `active`-past-expiry both surface as
 * `ended` so the dashboard legend stays small.
 */
export function surfaceCampaignStatus(
    status: CampaignStatus,
    expiresAt: Date | null,
    now: Date
): OverviewTopCampaign["status"] {
    if (status === "archived") return "ended";
    if (status === "active" && expiresAt && expiresAt < now) return "ended";
    if (status === "active" || status === "paused" || status === "draft") {
        return status;
    }
    return "ended";
}

/**
 * `DATE_TRUNC(...)` returns a raw SQL value Drizzle can't decode — it
 * comes back as a `Date` (postgres.js OID parser) or an ISO string
 * (raw text fallback) depending on the driver path. Normalise to ISO.
 */
export function toIsoString(value: Date | string): string {
    return value instanceof Date
        ? value.toISOString()
        : new Date(value).toISOString();
}
