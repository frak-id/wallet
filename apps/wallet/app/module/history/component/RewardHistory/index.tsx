import type { RewardHistory } from "@frak-labs/wallet-shared/types/RewardHistory";
import { formatUsd } from "@frak-labs/wallet-shared/wallet/utils/mUsdFormatter";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/module/common/component/Skeleton";
import { Title } from "@/module/common/component/Title";
import { HistoryDayGroup } from "@/module/history/component/DayGroup";
import { useGetRewardHistory } from "@/module/history/hook/useGetRewardHistory";
import styles from "./index.module.css";

export function RewardHistoryList() {
    const { history } = useGetRewardHistory();

    if (!history) return <Skeleton count={3} height={110} />;

    return (
        <HistoryDayGroup
            group={history}
            innerComponent={(reward) => <RewardHistoryItem reward={reward} />}
        />
    );
}

/**
 * Item for a reward history
 * @param reward
 * @constructor
 */
function RewardHistoryItem({ reward }: { reward: RewardHistory }) {
    const { t } = useTranslation();
    const amount = formatUsd(Number(reward.amount));
    const label =
        reward.type === "claim" ? t("common.claimed") : t("common.added");

    return (
        <>
            <div>
                <Title className={styles.reward__title}>
                    {reward.productName} - {label}
                </Title>
                <span className={styles.reward__date}>
                    {new Date(reward.timestamp * 1000).toLocaleString()}
                </span>
            </div>
            <div className={styles.reward__amount}>{amount}</div>
        </>
    );
}
