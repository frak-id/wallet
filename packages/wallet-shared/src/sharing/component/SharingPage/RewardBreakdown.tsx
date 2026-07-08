import type { EstimatedReward } from "@frak-labs/core-sdk";
import { formatAmount } from "@frak-labs/core-sdk";
import {
    buildPercentageExample,
    buildTierExample,
    type RewardExample,
} from "@frak-labs/core-sdk/rewards";
import * as styles from "./sharingPage.css";

type TieredReward = Extract<EstimatedReward, { payoutType: "tiered" }>;
type RewardTier = TieredReward["tiers"][number];

type Translate = (key: string, options?: Record<string, unknown>) => string;

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
    t,
}: {
    referrer?: EstimatedReward;
    referee?: EstimatedReward;
    minPurchaseValue?: number;
    t: Translate;
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
                    t={t}
                />
            )}
            {hasReferee && referee && (
                <RewardBlock
                    label={t("sdk.sharingPage.faq.reward.refereeLabel")}
                    reward={referee}
                    minPurchaseValue={minPurchaseValue}
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
    t,
}: {
    label: string;
    reward: EstimatedReward;
    minPurchaseValue?: number;
    t: Translate;
}) {
    return (
        <div className={styles.rewardBlock}>
            <span className={styles.rewardBlockLabel}>{label}</span>
            {reward.payoutType === "tiered"
                ? reward.tiers.map((tier) => (
                      <TierRow key={tierKey(tier)} tier={tier} t={t} />
                  ))
                : reward.payoutType === "percentage" && (
                      <PercentageRow
                          reward={reward}
                          minPurchaseValue={minPurchaseValue}
                          t={t}
                      />
                  )}
        </div>
    );
}

function TierRow({ tier, t }: { tier: RewardTier; t: Translate }) {
    const range =
        tier.maxValue == null
            ? t("sdk.sharingPage.faq.reward.tierAndAbove", {
                  min: formatAmount(tier.minValue),
              })
            : `${tier.minValue}–${formatAmount(tier.maxValue)}`;

    if ("amount" in tier) {
        return (
            <div className={styles.rewardRow}>
                <span>{range}</span>
                <span className={styles.rewardRowValue}>
                    {formatAmount(tier.amount.eurAmount)}
                </span>
            </div>
        );
    }

    const example = buildTierExample(
        tier.percent,
        tier.minValue,
        tier.maxValue
    );
    return (
        <div className={styles.rewardRow}>
            <span>{range}</span>
            <span className={styles.rewardRowValue}>
                {t("sdk.sharingPage.faq.reward.percentOfBasket", {
                    percent: tier.percent,
                })}
                {example && <ExampleText example={example} t={t} />}
            </span>
        </div>
    );
}

function PercentageRow({
    reward,
    minPurchaseValue,
    t,
}: {
    reward: Extract<EstimatedReward, { payoutType: "percentage" }>;
    minPurchaseValue?: number;
    t: Translate;
}) {
    const example = buildPercentageExample(reward, minPurchaseValue);
    return (
        <div className={styles.rewardRow}>
            <span>
                {t("sdk.sharingPage.faq.reward.percentOfBasket", {
                    percent: reward.percent,
                })}
            </span>
            {example && (
                <span className={styles.rewardRowValue}>
                    <ExampleText example={example} t={t} />
                </span>
            )}
        </div>
    );
}

function ExampleText({ example, t }: { example: RewardExample; t: Translate }) {
    return (
        <span className={styles.rewardExample}>
            {t("sdk.sharingPage.faq.reward.percentExample", {
                reward: formatAmount(example.reward),
                basket: formatAmount(example.basket),
            })}
        </span>
    );
}

function tierKey(tier: RewardTier): string {
    const value = "amount" in tier ? tier.amount.eurAmount : tier.percent;
    return `${tier.minValue}-${tier.maxValue ?? "inf"}-${value}`;
}
