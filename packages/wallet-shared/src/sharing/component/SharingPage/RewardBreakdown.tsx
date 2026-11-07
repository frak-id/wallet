import {
    type Currency,
    type EstimatedReward,
    formatAmount,
    getCurrencyAmountKey,
} from "@frak-labs/core-sdk";
import {
    buildPercentageExample,
    buildTierExample,
    isMatchedItemsBasis,
    type RewardExample,
} from "@frak-labs/core-sdk/rewards";
import {
    formatAmountRange,
    formatRewardAmount,
} from "../../../common/utils/formatCurrency";
import * as styles from "./sharingPage.css";
import type { SharingT } from "./types";

type TieredReward = Extract<EstimatedReward, { payoutType: "tiered" }>;
type RewardTier = TieredReward["tiers"][number];

/**
 * Per-audience reward detail rendered inside the "How is my reward calculated?"
 * FAQ answer. Mirrors the explorer's campaign card: tier rows for tiered
 * rewards, a "X% of basket" line with a worked example for percentage rewards.
 * Fixed rewards carry no breakdown and are skipped.
 */
export function RewardBreakdown({
    referrer,
    referee,
    minPurchaseValue,
    currency,
    payoutCurrency,
    t,
}: {
    referrer?: EstimatedReward;
    referee?: EstimatedReward;
    minPurchaseValue?: number;
    /** Display currency every amount of the breakdown is shown in; defaults to EUR. */
    currency?: Currency;
    /** Fiat tier thresholds are paid in; defaults to `currency`. */
    payoutCurrency?: Currency;
    t: SharingT;
}) {
    const hasReferrer = hasBreakdown(referrer);
    const hasReferee = hasBreakdown(referee);
    if (!(hasReferrer || hasReferee)) return null;

    return (
        <div className={styles.rewardBreakdown}>
            {hasReferrer && referrer && (
                <RewardBlock
                    label={t("sdk.sharingPage.faq.reward.referrerLabel")}
                    reward={referrer}
                    minPurchaseValue={minPurchaseValue}
                    currency={currency}
                    payoutCurrency={payoutCurrency}
                    t={t}
                />
            )}
            {hasReferee && referee && (
                <RewardBlock
                    label={t("sdk.sharingPage.faq.reward.refereeLabel")}
                    reward={referee}
                    minPurchaseValue={minPurchaseValue}
                    currency={currency}
                    payoutCurrency={payoutCurrency}
                    t={t}
                />
            )}
        </div>
    );
}

/** Whether a reward is worth a breakdown (percentage, or a tiered reward that
 * actually carries tiers — an empty tier list would render a bare label). */
function hasBreakdown(reward?: EstimatedReward): boolean {
    if (reward?.payoutType === "percentage") return true;
    if (reward?.payoutType === "tiered") return reward.tiers.length > 0;
    return false;
}

function RewardBlock({
    label,
    reward,
    minPurchaseValue,
    currency,
    payoutCurrency,
    t,
}: {
    label: string;
    reward: EstimatedReward;
    minPurchaseValue?: number;
    currency?: Currency;
    payoutCurrency?: Currency;
    t: SharingT;
}) {
    const matchedItemsBasis = isMatchedItemsBasis(reward);
    return (
        <div className={styles.rewardBlock}>
            <span className={styles.rewardBlockLabel}>{label}</span>
            {reward.payoutType === "tiered"
                ? reward.tiers.map((tier) => (
                      <TierRow
                          key={tierKey(tier, currency)}
                          tier={tier}
                          isMatchedItemsBasis={matchedItemsBasis}
                          currency={currency}
                          payoutCurrency={payoutCurrency}
                          t={t}
                      />
                  ))
                : reward.payoutType === "percentage" && (
                      <PercentageRow
                          reward={reward}
                          minPurchaseValue={minPurchaseValue}
                          isMatchedItemsBasis={matchedItemsBasis}
                          currency={currency}
                          t={t}
                      />
                  )}
        </div>
    );
}

function TierRow({
    tier,
    isMatchedItemsBasis,
    currency,
    payoutCurrency,
    t,
}: {
    tier: RewardTier;
    isMatchedItemsBasis: boolean;
    currency?: Currency;
    payoutCurrency?: Currency;
    t: SharingT;
}) {
    // Thresholds are token-denominated, so they read in the payout currency.
    const thresholdCurrency = payoutCurrency ?? currency;
    const range =
        tier.maxValue == null
            ? t("sdk.sharingPage.faq.reward.tierAndAbove", {
                  min: formatAmount(tier.minValue, thresholdCurrency),
              })
            : formatAmountRange(
                  tier.minValue,
                  tier.maxValue,
                  thresholdCurrency
              );

    if ("amount" in tier) {
        return (
            <div className={styles.rewardRow}>
                <span>{range}</span>
                <span className={styles.rewardRowValue}>
                    {formatRewardAmount(
                        tier.amount[getCurrencyAmountKey(currency)],
                        currency
                    )}
                </span>
            </div>
        );
    }

    // `buildTierExample` assumes a whole-basket reference, wrong for a percent
    // applied only to matched items.
    const example = isMatchedItemsBasis
        ? undefined
        : buildTierExample(tier.percent, tier.minValue, tier.maxValue);
    return (
        <div className={styles.rewardRow}>
            <span>{range}</span>
            <span className={styles.rewardRowValue}>
                {t(
                    isMatchedItemsBasis
                        ? "sdk.sharingPage.faq.reward.percentOfEligible"
                        : "sdk.sharingPage.faq.reward.percentOfBasket",
                    { percent: tier.percent }
                )}
                {example && (
                    <ExampleText
                        example={example}
                        currency={thresholdCurrency}
                        t={t}
                    />
                )}
            </span>
        </div>
    );
}

function PercentageRow({
    reward,
    minPurchaseValue,
    isMatchedItemsBasis,
    currency,
    t,
}: {
    reward: Extract<EstimatedReward, { payoutType: "percentage" }>;
    minPurchaseValue?: number;
    isMatchedItemsBasis: boolean;
    currency?: Currency;
    t: SharingT;
}) {
    // `buildPercentageExample` assumes a whole-basket reference, wrong for a
    // percent applied only to matched items.
    const example = isMatchedItemsBasis
        ? undefined
        : buildPercentageExample(reward, minPurchaseValue, currency);
    return (
        <div className={styles.rewardRow}>
            <span>
                {t(
                    isMatchedItemsBasis
                        ? "sdk.sharingPage.faq.reward.percentOfEligible"
                        : "sdk.sharingPage.faq.reward.percentOfBasket",
                    { percent: reward.percent }
                )}
            </span>
            {example && (
                <span className={styles.rewardRowValue}>
                    <ExampleText example={example} currency={currency} t={t} />
                </span>
            )}
        </div>
    );
}

function ExampleText({
    example,
    currency,
    t,
}: {
    example: RewardExample;
    currency?: Currency;
    t: SharingT;
}) {
    return (
        <span className={styles.rewardExample}>
            {t("sdk.sharingPage.faq.reward.percentExample", {
                reward: formatRewardAmount(example.reward, currency),
                basket: formatAmount(example.basket, currency),
            })}
        </span>
    );
}

function tierKey(tier: RewardTier, currency?: Currency): string {
    const value =
        "amount" in tier
            ? tier.amount[getCurrencyAmountKey(currency)]
            : tier.percent;
    return `${tier.minValue}-${tier.maxValue ?? "inf"}-${value}`;
}
