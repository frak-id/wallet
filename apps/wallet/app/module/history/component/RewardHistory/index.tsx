import type { RewardHistoryItem as RewardHistoryItemType } from "@frak-labs/wallet-shared";
import { Gift } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Panel } from "@/module/common/component/Panel";
import { Skeleton } from "@/module/common/component/Skeleton";
import { isCryptoMode } from "@/module/common/utils/walletMode";
import { useGetRewardHistory } from "@/module/history/hook/useGetRewardHistory";
import styles from "./index.module.css";

export function RewardHistoryList() {
    const { items, isLoading } = useGetRewardHistory();

    if (isLoading) return <Skeleton count={3} height={110} />;

    if (!items || items.length === 0) {
        return <RewardHistoryEmpty />;
    }

    return (
        <div className={styles.list}>
            {items.map((item, index) => (
                <RewardHistoryItem
                    key={`${item.createdAt}-${index}`}
                    item={item}
                />
            ))}
        </div>
    );
}

function RewardHistoryEmpty() {
    const { t } = useTranslation();

    return (
        <div className={styles.empty}>
            <Gift size={48} className={styles.empty__icon} />
            <span className={styles.empty__title}>
                {t("reward.history.empty")}
            </span>
            <span className={styles.empty__description}>
                {t(
                    "reward.history.emptyDescription",
                    "Your rewards will appear here once you start earning"
                )}
            </span>
        </div>
    );
}

function RewardHistoryItem({ item }: { item: RewardHistoryItemType }) {
    const { t } = useTranslation();

    const statusLabel = t(`reward.status.${item.status}`, item.status);

    const triggerLabel = t(`reward.trigger.${item.trigger}`, item.trigger);

    const roleLabel = t(`reward.role.${item.role}`, item.role);

    const displayAmount = isCryptoMode
        ? `+${item.amount.amount.toFixed(2)} ${item.token.symbol}`
        : `+${item.amount.eurAmount.toFixed(2)}€`;

    return (
        <Panel variant={"primary"} size={"small"} className={styles.item}>
            <div className={styles.item__header}>
                <span className={styles.item__merchant}>
                    {item.merchant.name}
                </span>
                <span className={styles.item__amount}>{displayAmount}</span>
            </div>
            <div className={styles.item__badges}>
                <span className={styles.item__badge}>{statusLabel}</span>
                <span className={styles.item__badge}>{triggerLabel}</span>
                <span className={styles.item__badge}>{roleLabel}</span>
            </div>
            <div className={styles.item__footer}>
                <span className={styles.item__date}>
                    {new Date(item.createdAt).toLocaleString()}
                </span>
                {isCryptoMode && item.txHash && (
                    <span className={styles.item__txHash}>
                        {item.txHash.slice(0, 10)}...
                    </span>
                )}
            </div>
        </Panel>
    );
}
