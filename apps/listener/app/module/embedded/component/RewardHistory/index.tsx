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
                    {t("rewards.history.title")}
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
    const timeAgo = getRelativeTime(reward.timestamp);

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
    if (!trigger) return t("rewards.history.trigger.unknown");

    const triggerMap: Record<string, string> = {
        referral: t("rewards.history.trigger.referral"),
        purchase: t("rewards.history.trigger.purchase"),
        wallet_connect: t("rewards.history.trigger.walletConnect"),
        identity_merge: t("rewards.history.trigger.identityMerge"),
    };

    return triggerMap[trigger] || t("rewards.history.trigger.unknown");
}

function getRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    // Fallback to date format for older rewards
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
    });
}
