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
        const best = live.reduce((a, b) =>
            campaignRank(b, key, audience) > campaignRank(a, key, audience)
                ? b
                : a
        );
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
