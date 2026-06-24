import type { InteractionTypeKey } from "../constants/interactionTypes";
import type { Currency, MerchantReward, TokenAmountType } from "../types";
import { getCurrencyAmountKey } from "../utils/format/getCurrencyAmountKey";
import { getSupportedCurrency } from "../utils/format/getSupportedCurrency";
import { extractStartDate } from "./conditions";
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
 * Headline reward string for a merchant: picks the best campaign for `options`
 * and formats its `audience`-side reward, or returns `undefined` when there is
 * nothing worth showing.
 *
 * Single entry point shared by every "headline reward" surface (share button,
 * wallet modal, sharing/install screens) so they all show the same number for
 * a given merchant.
 */
export function formatBestReward(
    rewards: readonly MerchantReward[],
    options: SelectDisplayCampaignOptions = {}
): string | undefined {
    const selected = selectDisplayCampaign(rewards, options);
    if (!selected) return undefined;
    const reward = audienceReward(
        selected.campaign,
        options.audience ?? "referrer"
    );
    return formatRewardOrHide(reward, options.currency);
}
