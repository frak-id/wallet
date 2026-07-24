import type { InteractionTypeKey } from "../constants/interactionTypes";
import type {
    Currency,
    EstimatedReward,
    MerchantReward,
    TokenAmountType,
} from "../types";
import { formatAmount } from "../utils/format/formatAmount";
import { getCurrencyAmountKey } from "../utils/format/getCurrencyAmountKey";
import { getSupportedCurrency } from "../utils/format/getSupportedCurrency";
import { extractMinPurchaseAmount, extractStartDate } from "./conditions";
import { formatRewardOrHide } from "./format";
import {
    matchesProductScope,
    type ProductScopeTarget,
} from "./matchesProductScope";
import { getRewardRank } from "./value";

/** Reward side a surface cares about: the sharer (`referrer`) or the referred
 * user (`referee`). Drives both campaign ranking and which side is displayed. */
export type RewardAudience = "referrer" | "referee";

export type DisplayCampaign = {
    campaign: MerchantReward;
    status: "live" | "upcoming";
    startsAt?: Date;
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
     * The product currently on display, when known (e.g. a product page).
     * Purely advisory (see {@link matchesProductScope}): when set, a
     * `productScope`d campaign whose scope does **not** match this product is
     * deprioritized below every campaign that does match (unscoped campaigns
     * always count as matching). Ranking *among* matching campaigns is
     * unchanged. Omit when the product isn't known — every campaign is then
     * treated as matching, same as today.
     */
    product?: ProductScopeTarget;
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

function matchesProduct(
    campaign: MerchantReward,
    product: ProductScopeTarget | undefined
): boolean {
    if (!product) return true;
    return matchesProductScope(campaign.productScope, product);
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
        // the winner when `options.product` is omitted, or among campaigns that
        // already agree on whether they match.
        const best = live.reduce((a, b) => {
            const aMatches = matchesProduct(a, options.product);
            const bMatches = matchesProduct(b, options.product);
            if (aMatches !== bMatches) return bMatches ? b : a;
            return campaignRank(b, key, audience) >
                campaignRank(a, key, audience)
                ? b
                : a;
        });
        return { campaign: best, status: "live" };
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

    const soonest = upcoming.reduce((a, b) =>
        b.startsAt.getTime() < a.startsAt.getTime() ? b : a
    );
    return {
        campaign: soonest.campaign,
        status: "upcoming",
        startsAt: soonest.startsAt,
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
     * Whether the selected campaign carries a `productScope` — the reward
     * only applies to matching line items, not the whole basket. Surfaces
     * use this to adapt copy that otherwise assumes a whole-basket reward
     * (e.g. "X% of basket" + a basket-based worked example, both wrong for a
     * scoped percentage/tiered reward).
     */
    isProductScoped: boolean;
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
