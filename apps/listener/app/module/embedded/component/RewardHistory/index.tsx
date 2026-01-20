import { useGetRewardHistory } from "@frak-labs/wallet-shared";
import { cx } from "class-variance-authority";
import { useState } from "react";
import { useListenerTranslation } from "@/module/providers/ListenerUiProvider";
import styles from "./index.module.css";

/**
 * Collapsible reward history section showing recent rewards
 */
export function RewardHistory() {
    const { t } = useListenerTranslation();
    const { rewards, isLoading } = useGetRewardHistory();
    const [isExpanded, setIsExpanded] = useState(false);

    // Show max 5 recent rewards
    const recentRewards = rewards.slice(0, 5);

    if (isLoading || recentRewards.length === 0) {
        return null;
    }

    return (
        <div className={styles.rewardHistory}>
            <button
                className={styles.rewardHistory__header}
                onClick={() => setIsExpanded(!isExpanded)}
                type="button"
                aria-expanded={isExpanded}
            >
                <span className={styles.rewardHistory__title}>
                    {t("reward.history.title")}
                </span>
                <span
                    className={cx(
                        styles.rewardHistory__toggle,
                        isExpanded && styles["rewardHistory__toggle--expanded"]
                    )}
                >
                    ▼
                </span>
            </button>

            {isExpanded && (
                <div className={styles.rewardHistory__content}>
                    {recentRewards.map((reward) => (
                        <RewardItem key={reward.id} reward={reward} />
                    ))}
                </div>
            )}
        </div>
    );
}

function RewardItem({
    reward,
}: {
    reward: ReturnType<typeof useGetRewardHistory>["rewards"][number];
}) {
    const { t } = useListenerTranslation();
    const timeAgo = getRelativeTime(reward.timestamp, t);

    return (
        <div
            className={cx(
                styles.rewardItem,
                styles[`rewardItem--${reward.status}`]
            )}
        >
            <div className={styles.rewardItem__main}>
                <div className={styles.rewardItem__info}>
                    <p className={styles.rewardItem__trigger}>
                        {getTriggerLabel(reward.trigger, t)}
                    </p>
                    <p className={styles.rewardItem__time}>{timeAgo}</p>
                </div>
                <p className={styles.rewardItem__amount}>
                    +{reward.amount.toFixed(2)} {reward.token.symbol}
                </p>
            </div>
        </div>
    );
}

function getTriggerLabel(
    trigger: string | null | undefined,
    t: (key: string) => string
): string {
    if (!trigger) return t("reward.trigger.unknown");

    const key = `reward.trigger.${trigger}`;
    const translated = t(key);
    return translated === key ? t("reward.trigger.unknown") : translated;
}

function getRelativeTime(
    timestamp: number,
    t: (key: string, options?: Record<string, unknown>) => string
): string {
    const now = Date.now();
    const diff = now - timestamp;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return t("reward.history.time.justNow");
    if (minutes < 60)
        return t("reward.history.time.minutesAgo", { count: minutes });
    if (hours < 24) return t("reward.history.time.hoursAgo", { count: hours });
    if (days < 7) return t("reward.history.time.daysAgo", { count: days });

    // Fallback to localized date for older rewards
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
    });
}
