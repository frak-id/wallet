import type { EstimatedReward } from "@frak-labs/core-sdk";
import { formatRewardOrHide } from "@frak-labs/core-sdk/rewards";
import { useReferralStatus } from "@frak-labs/wallet-shared";
import { useMemo } from "react";
import { addRewards } from "./addRewards";
import type { CampaignView } from "./campaignView";

type ReferralStatusSlice = {
    crossMerchantReferrer: object | null;
    merchantReferrer: object | null;
    frakReferral: { claimedMerchantIds: readonly string[] } | null;
};

export type PurchaseOffer = {
    cashback?: EstimatedReward;
    /** One-time Frak welcome bonus, paid on top of `cashback`. */
    welcomeBonus?: EstimatedReward;
    /** Cashback + bonus as one reward; unset when their shapes can't be added exactly. */
    total?: EstimatedReward;
    amount: string;
};

export type ShareOffer = {
    amount: string;
};

export type RewardOffer = {
    purchase?: PurchaseOffer;
    share?: ShareOffer;
};

function purchaseTotal(
    cashback: EstimatedReward | undefined,
    welcomeBonus: EstimatedReward | undefined
): { total?: EstimatedReward; amount?: string } {
    if (cashback && welcomeBonus) {
        const total = addRewards(cashback, welcomeBonus);
        return {
            total,
            amount: total
                ? formatRewardOrHide(total)
                : `${formatRewardOrHide(cashback)} + ${formatRewardOrHide(welcomeBonus)}`,
        };
    }
    const single = welcomeBonus ?? cashback;
    return { total: single, amount: formatRewardOrHide(single) };
}

/**
 * Splits a campaign into what this user earns by buying and by sharing.
 * `status` without a `merchantId` scope can't see a friend link shadowing
 * Frak, so the bonus is then a hint rather than a promise.
 */
export function buildRewardOffer(
    view: CampaignView | null,
    status: ReferralStatusSlice | undefined,
    merchantId: string
): RewardOffer {
    if (!view) return {};

    const hasReferrer =
        status?.crossMerchantReferrer != null ||
        status?.merchantReferrer != null;
    const isBonusEligible =
        status?.frakReferral != null &&
        status.merchantReferrer == null &&
        !status.frakReferral.claimedMerchantIds.includes(merchantId);

    const cashback =
        hasReferrer || !view.isReferralOnly
            ? keepIfDisplayable(view.referee)
            : undefined;
    const welcomeBonus = isBonusEligible
        ? keepIfDisplayable(view.welcomeBonus)
        : undefined;
    const { total, amount } = purchaseTotal(cashback, welcomeBonus);

    return {
        purchase: amount
            ? { cashback, welcomeBonus, total, amount }
            : undefined,
        share: view.headlineReferrerReward
            ? { amount: view.headlineReferrerReward }
            : undefined,
    };
}

function keepIfDisplayable(
    reward: EstimatedReward | undefined
): EstimatedReward | undefined {
    return formatRewardOrHide(reward) ? reward : undefined;
}

/**
 * `merchantScoped` costs one status request per merchant: detail only, cards
 * share the global status.
 */
export function useRewardOffer(
    view: CampaignView | null,
    merchantId: string,
    { merchantScoped = false }: { merchantScoped?: boolean } = {}
): RewardOffer {
    const { data: status } = useReferralStatus(
        merchantScoped ? { merchantId } : {}
    );
    return useMemo(
        () => buildRewardOffer(view, status, merchantId),
        [view, status, merchantId]
    );
}
