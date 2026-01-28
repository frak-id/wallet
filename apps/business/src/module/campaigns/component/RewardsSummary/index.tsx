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

function RewardItem({
    reward,
    currency,
}: {
    reward: RewardDefinition;
    currency: string;
}) {
    const amount = reward.amountType === "fixed" ? reward.amount : 0;
    const hasChaining = reward.amountType === "fixed" && reward.chaining;

    return (
        <li className={styles.rewards__item}>
            <span className={styles.rewards__recipient}>
                {capitalize(reward.recipient)}
            </span>
            <span className={styles.rewards__separator}>:</span>
            <span className={styles.rewards__amount}>
                {amount} {currency}
            </span>
            {hasChaining && (
                <span className={styles.rewards__chaining}>
                    — Chaining enabled ({reward.chaining?.deperditionPerLevel}%
                    decay, {reward.chaining?.maxDepth ?? "∞"} max depth)
                </span>
            )}
        </li>
    );
}
