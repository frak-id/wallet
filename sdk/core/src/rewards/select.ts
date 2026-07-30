import type { InteractionTypeKey } from "../constants/interactionTypes";
import type {
    Currency,
    EstimatedReward,
    MerchantReward,
    ProductDetails,
    TokenAmountType,
} from "../types";
import { formatAmount } from "../utils/format/formatAmount";
import { getCurrencyAmountKey } from "../utils/format/getCurrencyAmountKey";
import { getSupportedCurrency } from "../utils/format/getSupportedCurrency";
import { extractMinPurchaseAmount, extractStartDate } from "./conditions";
import { formatRewardOrHide } from "./format";
import { matchesProductScope } from "./matchesProductScope";
import { getRewardRank } from "./value";

/** Reward side a surface cares about: the sharer (`referrer`) or the referred
 * user (`referee`). Drives both campaign ranking and which side is displayed. */
export type RewardAudience = "referrer" | "referee";

export type DisplayCampaign = {
    campaign: MerchantReward;
    status: "live" | "upcoming";
    startsAt?: Date;
    /**
     * The subset of `options.products` that matched the winning campaign's
     * `productScope`, when it is scoped and at least one product matched.
     * `undefined` for an unscoped campaign (the reward applies to the whole
     * basket, so no single product "drove" it) or when no products were
     * supplied. Lets a surface name the product behind the reward ("earn 10 €
     * on <product>") instead of just showing the number.
     */
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
    /**
     * The products currently in view, when known (e.g. a product page's
     * single product, a cart, or an order's line items). Purely advisory
     * (see {@link matchesProductScope}): when set, a `productScope`d
     * campaign that doesn't match **any** of these products (mirroring the
     * backend, which pays out when any purchased line item matches) is
     * deprioritized below every campaign that matches at least one
     * (unscoped campaigns always count as matching). Ranking *among*
     * matching campaigns is unchanged. Omit, or pass an empty array, when no
     * product is known — every campaign is then treated as matching, same
     * as today. A single-element array reproduces the previous
     * single-product behavior exactly.
     */
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

/**
 * The subset of `products` that matches `campaign`'s `productScope`, or
 * `undefined` when the campaign is unscoped (matches everything, but there
 * is no specific product to name) or no products were supplied.
 */
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

/**
 * Whether `campaign` counts as matching for ranking purposes: any-match
 * against `products` (mirroring the backend, which pays out a purchase when
 * *any* line item matches the scope), trivially true when unscoped or when
 * no product context was supplied.
 */
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
 * Pick the single campaign a merchant surface should display.
 *
 * Filters out expired (and, when `targetInteraction` is set, non-matching)
 * campaigns, then prefers the highest-ranked *live* campaign — ranked by the
 * `audience` reward side in the requested currency. When none has started yet
 * it falls back to the soonest-starting upcoming campaign (the endpoint does
 * not gate on the start-date condition, so future-start campaigns come
 * through).
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
        // Product-matching campaigns are ranked first as a group; within each
        // group, the existing reward-value ranking applies unchanged. This only
        // ever moves a non-matching *scoped* campaign down — it never changes
        // the winner when `options.products` is omitted/empty, or among
        // campaigns that already agree on whether they match.
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

    // Same match-first grouping as the live branch, so a matching upcoming
    // campaign isn't buried behind a sooner-starting one that doesn't apply
    // to the product currently in view.
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
 * The single reward a merchant surface should display: its formatted string
 * plus the `payoutType` of the underlying reward, so surfaces can adapt their
 * presentation (e.g. hide percentage rewards, prefix tiered ones with "Up to").
 */
export type BestReward = {
    /** Display-ready reward string (e.g. `"5 €"`, `"10 %"`). */
    formatted: string;
    /** Payout type of the selected reward. */
    payoutType: EstimatedReward["payoutType"];
    /**
     * Minimum purchase amount gating the reward, formatted with the requested
     * currency (e.g. `"10 €"`), or `undefined` when the campaign sets no
     * minimum.
     */
    minPurchaseAmount?: string;
    /**
     * Whole-day lockup applied before the reward settles, or `undefined` when
     * the campaign has no lockup.
     */
    lockupDurationDays?: number;
    /**
     * Raw referrer/referee rewards of the selected campaign, surfaced so
     * consumers can render the full per-audience breakdown (tier rows,
     * percentage examples) rather than only the headline number.
     */
    referrerReward?: EstimatedReward;
    refereeReward?: EstimatedReward;
    /**
     * Raw minimum purchase value (unformatted), used to build percentage
     * worked-examples consistent with the campaign's gating.
     */
    minPurchaseValue?: number;
    /**
     * Whether the selected campaign is gated to a `productScope` — it only
     * pays out on purchases containing a matching line item. This is a
     * *gate*, not the reward's basis: a product-gated campaign can still pay
     * a percentage of the whole basket (e.g. `percentOf: "purchase_amount"`),
     * so surfaces should use this flag only for gate-related copy (e.g. "on
     * selected products only"). Whether the reward itself is computed over
     * matched line items rather than the whole basket is a separate question
     * — see {@link isMatchedItemsBasis}, which surfaces must use instead for
     * "% of basket" vs "% of eligible products" copy and worked-example
     * suppression.
     */
    isProductScoped: boolean;
    /**
     * The subset of `options.products` that matched the winning campaign's
     * `productScope`. See {@link DisplayCampaign.matchedProducts} — same
     * semantics, just surfaced alongside the formatted reward.
     */
    matchedProducts?: ProductDetails[];
};

/**
 * Pick the best campaign for `options` and resolve its `audience`-side reward
 * to a formatted string plus its `payoutType`, or `undefined` when there is
 * nothing worth showing.
 *
 * Single entry point shared by every "headline reward" surface (share button,
 * wallet modal, sharing/install screens) so they all show the same number for
 * a given merchant and can branch on the payout type.
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

/**
 * Headline reward string for a merchant: picks the best campaign for `options`
 * and formats its `audience`-side reward, or returns `undefined` when there is
 * nothing worth showing.
 *
 * Thin wrapper over {@link selectBestReward} for callers that only need the
 * formatted string.
 */
export function formatBestReward(
    rewards: readonly MerchantReward[],
    options: SelectDisplayCampaignOptions = {}
): string | undefined {
    return selectBestReward(rewards, options)?.formatted;
}
