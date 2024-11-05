import { Skeleton } from "@/module/common/component/Skeleton";
import { Title } from "@/module/common/component/Title";
import { HistoryDayGroup } from "@/module/history/component/DayGroup";
import { useGetInteractionHistory } from "@/module/history/hook/useGetInteractionHistory";
import type { InteractionHistory } from "@/types/InteractionHistory";
import { useTranslation } from "react-i18next";
import styles from "./index.module.css";

export function InteractionHistoryList() {
    const { history } = useGetInteractionHistory();

    if (!history) return <Skeleton count={3} height={110} />;

    return (
        <HistoryDayGroup
            group={history}
            innerComponent={(item) => (
                <InteractionHistoryItem interaction={item} />
            )}
        />
    );
}

/**
 * Item for a interaction history
 * @param interaction
 * @constructor
 */
function InteractionHistoryItem({
    interaction,
}: { interaction: InteractionHistory }) {
    const { t } = useTranslation();

    return (
        <div>
            <Title className={styles.interaction__title}>
                {interaction.productName} -{" "}
                {t(`wallet.interaction.${interaction.type}`)}
            </Title>
            <span className={styles.interaction__date}>
                {new Date(interaction.timestamp * 1000).toLocaleString()}
            </span>
        </div>
    );
}
