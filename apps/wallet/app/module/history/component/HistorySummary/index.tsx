import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { EarningsIcon, PeopleIcon } from "@frak-labs/design-system/icons";
import type { RewardHistoryItem } from "@frak-labs/wallet-shared";
import { useTranslation } from "react-i18next";
import { computeHistoryStats } from "@/module/history/utils/computeHistoryStats";
import * as styles from "./index.css";

export function HistorySummary({ items }: { items: RewardHistoryItem[] }) {
    const { t, i18n } = useTranslation();
    const locale = i18n.language;
    const stats = computeHistoryStats(items);

    const formattedTotal = new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "EUR",
    }).format(stats.totalEarningsEur);

    return (
        <Stack space="xs">
            <Inline space="xs" wrap={false}>
                <Card padding="compact" className={styles.statContent}>
                    <Inline space="xxs" alignY="center">
                        <Text color="secondary" className={styles.icon}>
                            <PeopleIcon width={16} height={16} />
                        </Text>
                        <Text
                            variant="bodySmall"
                            weight="semiBold"
                            color="secondary"
                            className={styles.label}
                        >
                            {t("reward.history.stats.totalShares")}
                        </Text>
                    </Inline>
                    <Text weight="semiBold">{stats.totalShares}</Text>
                </Card>
                <Card padding="compact" className={styles.statContent}>
                    <Inline space="xxs">
                        <Text color="secondary" className={styles.icon}>
                            <PeopleIcon width={16} height={16} />
                        </Text>
                        <Text
                            variant="bodySmall"
                            weight="semiBold"
                            color="secondary"
                            className={styles.label}
                        >
                            {t("reward.history.stats.totalPurchases")}
                        </Text>
                    </Inline>
                    <Text weight="semiBold">{stats.totalPurchases}</Text>
                </Card>
            </Inline>
            <Card padding="compact" className={styles.statContent}>
                <Inline space="xxs">
                    <Text color="secondary" className={styles.icon}>
                        <EarningsIcon width={16} height={16} />
                    </Text>
                    <Text
                        variant="bodySmall"
                        weight="semiBold"
                        color="secondary"
                        className={styles.label}
                    >
                        {t("reward.history.stats.totalEarnings")}
                    </Text>
                </Inline>
                <Text variant="body" weight="semiBold" color="success">
                    {formattedTotal}
                </Text>
            </Card>
        </Stack>
    );
}
