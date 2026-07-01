import type { EstimatedReward, MerchantReward } from "@frak-labs/core-sdk";
import { formatAmount } from "@frak-labs/core-sdk";
import {
    extractMinPurchaseAmount,
    formatRewardOrHide,
    selectDisplayCampaign,
} from "@frak-labs/core-sdk/rewards";
import { estimatedRewardsQueryOptions } from "@frak-labs/wallet-shared";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

const SECONDS_PER_DAY = 86400;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

function formatDate(date: Date, locale: string): string {
    return date.toLocaleDateString(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

function getDaysRemaining(end: Date, now: Date): number | null {
    const diffMs = end.getTime() - now.getTime();
    if (diffMs <= 0) return null;
    return Math.ceil(diffMs / MS_PER_DAY);
}

function lockupSecondsToDays(seconds: number | undefined): number | undefined {
    return seconds != null ? Math.floor(seconds / SECONDS_PER_DAY) : undefined;
}

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

function buildCampaignView(
    rewards: MerchantReward[],
    locale: string,
    now: Date = new Date()
): CampaignView | null {
    const selected = selectDisplayCampaign(rewards, { now });
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
        headlineReferrerReward: formatRewardOrHide(campaign.referrer),
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

/**
 * Fetches the merchant's estimated rewards and derives the display campaign
 * view, memoized on the rewards + active language. Shared by the explorer card
 * and detail surfaces.
 */
export function useCampaignView(merchantId: string): CampaignView | null {
    const { i18n } = useTranslation();
    const { data: rewards } = useQuery(
        estimatedRewardsQueryOptions(merchantId)
    );
    return useMemo(
        () => buildCampaignView(rewards ?? [], i18n.language),
        [rewards, i18n.language]
    );
}
