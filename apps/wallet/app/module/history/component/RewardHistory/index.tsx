import { Box } from "@frak-labs/ui/component/Box";
import type { RewardHistoryItem as RewardHistoryItemType } from "@frak-labs/wallet-shared";
import { Gift } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Panel } from "@/module/common/component/Panel";
import { Skeleton } from "@/module/common/component/Skeleton";
import { isCryptoMode } from "@/module/common/utils/walletMode";
import { useGetRewardHistory } from "@/module/history/hook/useGetRewardHistory";
import styles from "./index.module.css";

export function RewardHistoryList() {
    const { rewards, isLoading } = useGetRewardHistory();

    if (isLoading) return <Skeleton count={3} height={110} />;

    if (!rewards || rewards.length === 0) {
        return <RewardHistoryEmpty />;
    }

    return (
        <div className={styles.list}>
            {rewards.map((reward) => (
                <RewardHistoryItem key={reward.id} reward={reward} />
            ))}
        </div>
    );
}

function RewardHistoryEmpty() {
    const { t } = useTranslation();

    return (
        <Box padding="l" className={styles.empty}>
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
        </Box>
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
            <Box
                direction="row"
                padding="none"
                justify="between"
                align="center"
            >
                <span className={styles.item__merchant}>
                    {reward.merchant.name}
                </span>
                <span className={styles.item__amount}>
                    +{reward.amount.toFixed(2)}
                    {isCryptoMode ? ` ${reward.token.symbol}` : "€"}
                </span>
            </Box>
            <div className={styles.item__badges}>
                <span className={styles.item__badge}>{statusLabel}</span>
                {triggerLabel && (
                    <span className={styles.item__badge}>{triggerLabel}</span>
                )}
            </div>
            <Box
                direction="row"
                padding="none"
                justify="between"
                align="center"
            >
                <span className={styles.item__date}>
                    {new Date(reward.timestamp).toLocaleString()}
                </span>
                {isCryptoMode && reward.txHash && (
                    <span className={styles.item__txHash}>
                        {reward.txHash.slice(0, 10)}...
                    </span>
                )}
            </Box>
        </Panel>
    );
}
