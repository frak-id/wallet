import type { EstimatedRewardItem } from "@frak-labs/backend-elysia/domain/campaign";
import { getRewardEurValue } from "../value";
import { extractStartDate } from "./conditions";

function campaignRewardValue(campaign: EstimatedRewardItem): number {
    const referrer = campaign.referrer
        ? getRewardEurValue(campaign.referrer)
        : 0;
    const referee = campaign.referee ? getRewardEurValue(campaign.referee) : 0;
    return Math.max(referrer, referee);
}

export type DisplayCampaign = {
    campaign: EstimatedRewardItem;
    status: "live" | "upcoming";
    startsAt?: Date;
};

function isExpired(campaign: EstimatedRewardItem, nowMs: number): boolean {
    return (
        campaign.expiresAt != null &&
        new Date(campaign.expiresAt).getTime() <= nowMs
    );
}

function hasStarted(campaign: EstimatedRewardItem, nowMs: number): boolean {
    const startsAt = extractStartDate(campaign.conditions);
    return startsAt == null || startsAt.getTime() <= nowMs;
}

// The endpoint does not gate on the start-date condition, so future-start
// campaigns come through: prefer the richest started one, else the soonest.
export function selectDisplayCampaign(
    rewards: EstimatedRewardItem[],
    now: Date = new Date()
): DisplayCampaign | undefined {
    const nowMs = now.getTime();
    const active = rewards.filter((campaign) => !isExpired(campaign, nowMs));

    const live = active.filter((campaign) => hasStarted(campaign, nowMs));
    if (live.length > 0) {
        const best = live.reduce((a, b) =>
            campaignRewardValue(b) > campaignRewardValue(a) ? b : a
        );
        return { campaign: best, status: "live" };
    }

    const upcoming = active
        .map((campaign) => ({
            campaign,
            startsAt: extractStartDate(campaign.conditions),
        }))
        .filter(
            (
                entry
            ): entry is { campaign: EstimatedRewardItem; startsAt: Date } =>
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
