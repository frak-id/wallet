import type { RewardHistoryItem as RewardHistoryItemType } from "@frak-labs/wallet-shared";
import { useTranslation } from "react-i18next";
import { Panel } from "@/module/common/component/Panel";
import { Skeleton } from "@/module/common/component/Skeleton";
import { useGetRewardHistory } from "@/module/history/hook/useGetRewardHistory";
import styles from "./index.module.css";

export function RewardHistoryList() {
    const { t } = useTranslation();
    const { rewards, isLoading } = useGetRewardHistory();

    if (isLoading) return <Skeleton count={3} height={110} />;

    if (!rewards || rewards.length === 0) {
        return <div className={styles.empty}>{t("reward.history.empty")}</div>;
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
    const statusLabel = t(`reward.status.${reward.status}`, reward.status);
    const triggerLabel = reward.trigger
        ? t(`reward.trigger.${reward.trigger}`, reward.trigger)
        : null;

    return (
        <Panel variant={"primary"} size={"small"} className={styles.item}>
            <div className={styles.item__header}>
                <span className={styles.item__merchant}>
                    {reward.merchant.name}
                </span>
                <span className={styles.item__amount}>
                    +{reward.amount.toFixed(2)} {reward.token.symbol}
                </span>
            </div>
            <div className={styles.item__badges}>
                <span className={styles.item__badge}>{statusLabel}</span>
                {triggerLabel && (
                    <span className={styles.item__badge}>{triggerLabel}</span>
                )}
            </div>
            <div className={styles.item__footer}>
                <span className={styles.item__date}>
                    {new Date(reward.timestamp).toLocaleString()}
                </span>
                {reward.txHash && (
                    <span className={styles.item__txHash}>
                        {reward.txHash.slice(0, 10)}...
                    </span>
                )}
            </div>
        </Panel>
    );
}
