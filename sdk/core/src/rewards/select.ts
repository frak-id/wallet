import type { InteractionTypeKey } from "../constants/interactionTypes";
import type {
    Currency,
    EstimatedReward,
    MerchantReward,
    ProductDetails,
    TokenAmountType,
} from "../types";
import { formatAmount } from "../utils/format/formatAmount";
import type { RewardAmountParts } from "../utils/format/formatAmountParts";
import { getCurrencyAmountKey } from "../utils/format/getCurrencyAmountKey";
import { getSupportedCurrency } from "../utils/format/getSupportedCurrency";
import { extractMinPurchaseAmount, extractStartDate } from "./conditions";
import { formatEstimatedRewardParts, formatRewardOrHide } from "./format";
import { matchesProductScope } from "./matchesProductScope";
import { getRewardRank } from "./value";

/** Reward side a surface cares about: `referrer` (sharer) or `referee`. */
export type RewardAudience = "referrer" | "referee";

export type DisplayCampaign = {
    campaign: MerchantReward;
    status: "live" | "upcoming";
    startsAt?: Date;
    /** Products matching the campaign's `productScope`, when it has one. */
    matchedProducts?: ProductDetails[];
};

export type SelectDisplayCampaignOptions = {
    /** Reference "now" for expiry / start gating; defaults to the current time. */
    now?: Date;
    /** Currency the ranking is expressed in; defaults to EUR. */
    currency?: Currency;
    /** When set, only campaigns triggered by this interaction are considered. */
    targetInteraction?: InteractionTypeKey;
    /** Reward side to rank campaigns by; defaults to `"referrer"`. */
    audience?: RewardAudience;
    /** Products in view; advisory — campaigns matching one rank first. */
    products?: ProductDetails[];
};

function isExpired(campaign: MerchantReward, nowMs: number): boolean {
    return (
        campaign.expiresAt != null &&
        new Date(campaign.expiresAt).getTime() <= nowMs
    );
}

function hasStarted(campaign: MerchantReward, nowMs: number): boolean {
    const startsAt = extractStartDate(campaign.conditions);
    return startsAt == null || startsAt.getTime() <= nowMs;
}

function audienceReward(campaign: MerchantReward, audience: RewardAudience) {
    return audience === "referee" ? campaign.referee : campaign.referrer;
}

function campaignRank(
    campaign: MerchantReward,
    key: keyof TokenAmountType,
    audience: RewardAudience
): number {
    const reward = audienceReward(campaign, audience);
    return reward ? getRewardRank(reward, key) : 0;
}

function matchedProductsFor(
    campaign: MerchantReward,
    products: ProductDetails[] | undefined
): ProductDetails[] | undefined {
    if (!products || products.length === 0) return undefined;
    if (!campaign.productScope) return undefined;
    const matched = products.filter((product) =>
        matchesProductScope(campaign.productScope, product)
    );
    return matched.length > 0 ? matched : undefined;
}

/** Any-match, like the backend: it pays out when any line item matches. */
function matchesProduct(
    campaign: MerchantReward,
    products: ProductDetails[] | undefined
): boolean {
    if (!products || products.length === 0) return true;
    if (!campaign.productScope) return true;
    return products.some((product) =>
        matchesProductScope(campaign.productScope, product)
    );
}

/**
 * Pick the single campaign a merchant surface should display: the
 * highest-ranked live one, else the soonest-starting upcoming one.
 */
export function selectDisplayCampaign(
    rewards: readonly MerchantReward[],
    options: SelectDisplayCampaignOptions = {}
): DisplayCampaign | undefined {
    const nowMs = (options.now ?? new Date()).getTime();
    const audience = options.audience ?? "referrer";
    const key = getCurrencyAmountKey(getSupportedCurrency(options.currency));

    const matching = options.targetInteraction
        ? rewards.filter(
              (campaign) =>
                  campaign.interactionTypeKey === options.targetInteraction
          )
        : rewards;
    const active = matching.filter((campaign) => !isExpired(campaign, nowMs));

    const live = active.filter((campaign) => hasStarted(campaign, nowMs));
    if (live.length > 0) {
        // Product-matching campaigns rank first; value decides within a group.
        const best = live.reduce((a, b) => {
            const aMatches = matchesProduct(a, options.products);
            const bMatches = matchesProduct(b, options.products);
            if (aMatches !== bMatches) return bMatches ? b : a;
            return campaignRank(b, key, audience) >
                campaignRank(a, key, audience)
                ? b
                : a;
        });
        return {
            campaign: best,
            status: "live",
            matchedProducts: matchedProductsFor(best, options.products),
        };
    }

    const upcoming = active
        .map((campaign) => ({
            campaign,
            startsAt: extractStartDate(campaign.conditions),
        }))
        .filter(
            (entry): entry is { campaign: MerchantReward; startsAt: Date } =>
                entry.startsAt != null
        );
    if (upcoming.length === 0) return undefined;

    // Same match-first grouping as the live branch.
    const soonest = upcoming.reduce((a, b) => {
        const aMatches = matchesProduct(a.campaign, options.products);
        const bMatches = matchesProduct(b.campaign, options.products);
        if (aMatches !== bMatches) return bMatches ? b : a;
        return b.startsAt.getTime() < a.startsAt.getTime() ? b : a;
    });
    return {
        campaign: soonest.campaign,
        status: "upcoming",
        startsAt: soonest.startsAt,
        matchedProducts: matchedProductsFor(soonest.campaign, options.products),
    };
}

/**
 * The single reward a merchant surface should display: the formatted string
 * plus the payout type and raw campaign data behind it.
 */
export type BestReward = {
    /** Display-ready reward string (e.g. `"5 €"`, `"10 %"`). */
    formatted: string;
    /** {@link formatted} pre-split into integer / decimals / unit. */
    parts?: RewardAmountParts;
    /** Payout type of the selected reward. */
    payoutType: EstimatedReward["payoutType"];
    /** Minimum purchase gating the reward, formatted (e.g. `"10 €"`). */
    minPurchaseAmount?: string;
    /** Whole-day lockup applied before the reward settles. */
    lockupDurationDays?: number;
    /** Raw rewards of the selected campaign, for per-audience breakdowns. */
    referrerReward?: EstimatedReward;
    refereeReward?: EstimatedReward;
    /** Raw minimum purchase value, for percentage worked-examples. */
    minPurchaseValue?: number;
    /**
     * Whether the campaign is gated to a `productScope`. The gate, not the
     * reward basis — use {@link isMatchedItemsBasis} for basis copy.
     */
    isProductScoped: boolean;
    /** See {@link DisplayCampaign.matchedProducts}. */
    matchedProducts?: ProductDetails[];
};

/**
 * Pick the best campaign for `options` and resolve its `audience`-side reward,
 * or `undefined` when there is nothing worth showing.
 */
export function selectBestReward(
    rewards: readonly MerchantReward[],
    options: SelectDisplayCampaignOptions = {}
): BestReward | undefined {
    const selected = selectDisplayCampaign(rewards, options);
    if (!selected) return undefined;
    const reward = audienceReward(
        selected.campaign,
        options.audience ?? "referrer"
    );
    if (!reward) return undefined;
    const formatted = formatRewardOrHide(reward, options.currency);
    if (!formatted) return undefined;

    const minPurchase = extractMinPurchaseAmount(selected.campaign.conditions);
    const minPurchaseAmount =
        minPurchase != null
            ? formatAmount(minPurchase, options.currency)
            : undefined;

    const lockupSeconds = selected.campaign.defaultLockupSeconds;
    const lockupDurationDays =
        lockupSeconds && lockupSeconds > 0
            ? Math.round(lockupSeconds / 86_400)
            : undefined;

    return {
        formatted,
        parts: formatEstimatedRewardParts(reward, options.currency),
        payoutType: reward.payoutType,
        minPurchaseAmount,
        lockupDurationDays,
        referrerReward: selected.campaign.referrer,
        refereeReward: selected.campaign.referee,
        minPurchaseValue: minPurchase ?? undefined,
        isProductScoped: selected.campaign.productScope != null,
        matchedProducts: selected.matchedProducts,
    };
}

/** {@link selectBestReward}, reduced to just the formatted string. */
export function formatBestReward(
    rewards: readonly MerchantReward[],
    options: SelectDisplayCampaignOptions = {}
): string | undefined {
    return selectBestReward(rewards, options)?.formatted;
}
