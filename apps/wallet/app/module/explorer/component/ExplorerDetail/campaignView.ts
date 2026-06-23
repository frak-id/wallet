import type { EstimatedRewardItem } from "@frak-labs/backend-elysia/domain/campaign";
import type { EstimatedReward } from "@frak-labs/core-sdk";
import { formatAmount } from "@frak-labs/core-sdk";
import { formatEstimatedReward } from "@frak-labs/wallet-shared";
import {
    extractMinPurchaseAmount,
    formatDate,
    getDaysRemaining,
    lockupSecondsToDays,
    selectDisplayCampaign,
} from "./campaignDisplay";

export type CampaignView = {
    status: "live" | "upcoming";
    referrer?: EstimatedReward;
    referee?: EstimatedReward;
    headlineReferrerReward?: string;
    formattedStartDate?: string;
    formattedEndDate?: string;
    daysRemaining?: number | null;
    isImmediate: boolean;
    pendingDays?: number;
    minPurchaseAmount?: number;
    minPurchaseDisplay?: string;
};

export function buildCampaignView(
    rewards: EstimatedRewardItem[],
    locale: string,
    now: Date = new Date()
): CampaignView | null {
    const selected = selectDisplayCampaign(rewards, now);
    if (!selected) return null;

    const { campaign, status, startsAt } = selected;
    const minPurchaseAmount = extractMinPurchaseAmount(campaign.conditions);
    const pendingDays = lockupSecondsToDays(campaign.defaultLockupSeconds);
    const endDate = campaign.expiresAt
        ? new Date(campaign.expiresAt)
        : undefined;

    return {
        status,
        referrer: campaign.referrer,
        referee: campaign.referee,
        headlineReferrerReward: campaign.referrer
            ? formatEstimatedReward(campaign.referrer)
            : undefined,
        formattedStartDate: startsAt ? formatDate(startsAt, locale) : undefined,
        formattedEndDate: endDate ? formatDate(endDate, locale) : undefined,
        daysRemaining: endDate ? getDaysRemaining(endDate, now) : undefined,
        isImmediate: pendingDays == null || pendingDays === 0,
        pendingDays,
        minPurchaseAmount,
        minPurchaseDisplay:
            minPurchaseAmount != null && minPurchaseAmount > 0
                ? formatAmount(minPurchaseAmount)
                : undefined,
    };
}
