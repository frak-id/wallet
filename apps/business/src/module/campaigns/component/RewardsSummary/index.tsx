import { capitalize } from "radash";
import { FormDescription, FormItem } from "@/module/forms/Form";
import { currencyStore } from "@/stores/currencyStore";
import type { RewardDefinition } from "@/types/Campaign";
import styles from "./index.module.css";

type RewardsSummaryProps = {
    rewards: RewardDefinition[];
};

export function RewardsSummary({ rewards }: RewardsSummaryProps) {
    const preferredCurrency = currencyStore((state) => state.preferredCurrency);

    if (rewards.length === 0) {
        return (
            <FormItem>
                <FormDescription label="Rewards" />
                <span className={styles.rewards__empty}>
                    No rewards configured
                </span>
            </FormItem>
        );
    }

    return (
        <FormItem>
            <FormDescription label="Rewards" />
            <ul className={styles.rewards__list}>
                {rewards.map((reward, index) => (
                    <RewardItem
                        key={`${reward.recipient}-${index}`}
                        reward={reward}
                        currency={preferredCurrency.toUpperCase()}
                    />
                ))}
            </ul>
        </FormItem>
    );
}

function formatPercentOf(value: string): string {
    return value.replace(/_/g, " ");
}

function RewardAmount({
    reward,
    currency,
}: {
    reward: RewardDefinition;
    currency: string;
}) {
    if (reward.amountType === "fixed") {
        return (
            <span className={styles.rewards__amount}>
                {reward.amount} {currency}
            </span>
        );
    }

    if (reward.amountType === "percentage") {
        const bounds = [];
        if (reward.minAmount !== undefined) {
            bounds.push(`min ${reward.minAmount} ${currency}`);
        }
        if (reward.maxAmount !== undefined) {
            bounds.push(`max ${reward.maxAmount} ${currency}`);
        }
        return (
            <>
                <span className={styles.rewards__amount}>
                    {reward.percent}% of {formatPercentOf(reward.percentOf)}
                </span>
                {bounds.length > 0 && (
                    <span className={styles.rewards__details}>
                        ({bounds.join(", ")})
                    </span>
                )}
            </>
        );
    }

    if (reward.amountType === "tiered") {
        return (
            <span className={styles.rewards__amount}>
                Tiered by {reward.tierField}
                {reward.tiers.map((tier, i) => (
                    <span key={i} className={styles.rewards__details}>
                        {" "}
                        {tier.minValue}
                        {tier.maxValue !== undefined
                            ? `–${tier.maxValue}`
                            : "+"}
                        : {tier.amount} {currency}
                    </span>
                ))}
            </span>
        );
    }

    return null;
}

function RewardItem({
    reward,
    currency,
}: {
    reward: RewardDefinition;
    currency: string;
}) {
    const hasChaining = !!reward.chaining;

    return (
        <li className={styles.rewards__item}>
            <span className={styles.rewards__recipient}>
                {capitalize(reward.recipient)}
            </span>
            <span className={styles.rewards__separator}>:</span>
            <RewardAmount reward={reward} currency={currency} />
            {hasChaining && (
                <span className={styles.rewards__chaining}>
                    — Chaining enabled ({reward.chaining?.deperditionPerLevel}%
                    decay, {reward.chaining?.maxDepth ?? "∞"} max depth)
                </span>
            )}
        </li>
    );
}
