import type { RewardHistoryItem as RewardHistoryItemType } from "@frak-labs/wallet-shared";
import { formatUsd } from "@frak-labs/wallet-shared";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/module/common/component/Skeleton";
import { Title } from "@/module/common/component/Title";
import { useGetRewardHistory } from "@/module/history/hook/useGetRewardHistory";
import styles from "./index.module.css";

export function RewardHistoryList() {
    const { rewards, isLoading } = useGetRewardHistory();

    if (isLoading) return <Skeleton count={3} height={110} />;

    if (!rewards || rewards.length === 0) {
        return <div className={styles.empty}>No rewards yet</div>;
    }

    return (
        <div className={styles.list}>
            {rewards.map((reward) => (
                <RewardHistoryItem key={reward.id} reward={reward} />
            ))}
        </div>
    );
}

function RewardHistoryItem({ reward }: { reward: RewardHistoryItemType }) {
    const { t } = useTranslation();
    const amount = formatUsd(Number(reward.amount));
    const statusLabel = t(`reward.status.${reward.status}`, reward.status);
    const triggerLabel = reward.trigger
        ? t(`reward.trigger.${reward.trigger}`, reward.trigger)
        : null;

    return (
        <div className={styles.item}>
            <div className={styles.item__header}>
                <Title className={styles.item__title}>
                    {reward.merchant.name}
                </Title>
                <div className={styles.item__amount}>{amount}</div>
            </div>
            <div className={styles.item__meta}>
                <span className={styles.item__date}>
                    {new Date(reward.timestamp).toLocaleString()}
                </span>
                <span className={styles.item__status}>{statusLabel}</span>
                {triggerLabel && (
                    <span className={styles.item__trigger}>{triggerLabel}</span>
                )}
            </div>
            {reward.txHash && (
                <div className={styles.item__tx}>
                    <span className={styles.item__txLabel}>Tx:</span>
                    <span className={styles.item__txHash}>
                        {reward.txHash.slice(0, 10)}...
                    </span>
                </div>
            )}
        </div>
    );
}
