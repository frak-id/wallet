import type { Currency, EstimatedReward } from "@frak-labs/core-sdk";
import { getSupportedCurrency } from "@frak-labs/core-sdk";
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
    /** Fiat {@link total} is shown in. */
    totalCurrency?: Currency;
    amount: string;
};

export type ShareOffer = {
    amount: string;
};

export type RewardOffer = {
    purchase?: PurchaseOffer;
    share?: ShareOffer;
};

type PricedReward = {
    reward: EstimatedReward | undefined;
    currency: Currency | undefined;
};

function purchaseTotal(
    cashback: PricedReward,
    welcomeBonus: PricedReward
): { total?: EstimatedReward; totalCurrency?: Currency; amount?: string } {
    if (cashback.reward && welcomeBonus.reward) {
        // Two payouts in different fiats have no single currency to add in.
        const total =
            getSupportedCurrency(cashback.currency) ===
            getSupportedCurrency(welcomeBonus.currency)
                ? addRewards(cashback.reward, welcomeBonus.reward)
                : undefined;
        return {
            total,
            totalCurrency: cashback.currency,
            amount: total
                ? formatRewardOrHide(total, cashback.currency)
                : `${formatRewardOrHide(cashback.reward, cashback.currency)} + ${formatRewardOrHide(welcomeBonus.reward, welcomeBonus.currency)}`,
        };
    }
    const single = welcomeBonus.reward ? welcomeBonus : cashback;
    return {
        total: single.reward,
        totalCurrency: single.currency,
        amount: formatRewardOrHide(single.reward, single.currency),
    };
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
            ? keepIfDisplayable(view.referee, view.payoutCurrency)
            : undefined;
    const welcomeBonus = isBonusEligible
        ? keepIfDisplayable(view.welcomeBonus, view.welcomeBonusCurrency)
        : undefined;
    const { total, totalCurrency, amount } = purchaseTotal(
        { reward: cashback, currency: view.payoutCurrency },
        { reward: welcomeBonus, currency: view.welcomeBonusCurrency }
    );

    return {
        purchase: amount
            ? { cashback, welcomeBonus, total, totalCurrency, amount }
            : undefined,
        share: view.headlineReferrerReward
            ? { amount: view.headlineReferrerReward }
            : undefined,
    };
}

function keepIfDisplayable(
    reward: EstimatedReward | undefined,
    currency: Currency | undefined
): EstimatedReward | undefined {
    return formatRewardOrHide(reward, currency) ? reward : undefined;
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
