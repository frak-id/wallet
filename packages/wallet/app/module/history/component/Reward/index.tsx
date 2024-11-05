import { formatUsd } from "@/context/wallet/utils/mUsdFormatter";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import type { RewardHistory } from "@/types/RewardHistory";
import { useTranslation } from "react-i18next";
import styles from "./index.module.css";

type RewardProps = {
    reward: RewardHistory;
};

export function Reward({ reward }: RewardProps) {
    const { t } = useTranslation();
    const amount = formatUsd(Number(reward.amount));
    const label =
        reward.type === "claim" ? t("common.claimed") : t("common.added");

    return (
        <Panel size={"small"} className={styles.reward}>
            <div>
                <Title className={styles.reward__title}>
                    {reward.productName} - {label}
                </Title>
                <span className={styles.reward__date}>
                    {new Date(reward.timestamp * 1000).toLocaleString()}
                </span>
            </div>
            <div className={styles.reward__amount}>{amount}</div>
        </Panel>
    );
}
