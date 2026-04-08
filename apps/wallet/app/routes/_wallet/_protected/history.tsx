import { Stack } from "@frak-labs/design-system/components/Stack";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Back } from "@/module/common/component/Back";
import { Skeleton } from "@/module/common/component/Skeleton";
import { Title } from "@/module/common/component/Title";
import { HistoryDayGroup } from "@/module/history/component/DayGroup";
import { HistorySummary } from "@/module/history/component/HistorySummary";
import { RewardHistoryItem as RewardHistoryItemComponent } from "@/module/history/component/RewardHistory";
import { useGetRewardHistory } from "@/module/history/hook/useGetRewardHistory";
import { computeDayTotals } from "@/module/history/utils/computeHistoryStats";
import { groupByDay } from "@/module/history/utils/groupByDay";

export const Route = createFileRoute("/_wallet/_protected/history")({
    component: HistoryPage,
});

function HistoryPage() {
    const { t, i18n } = useTranslation();
    const { items, isLoading } = useGetRewardHistory();

    const grouped = useMemo(
        () =>
            groupByDay(
                items.map((item) => ({
                    ...item,
                    timestamp: Math.floor(item.createdAt / 1000),
                })),
                {
                    locale: i18n.language,
                    todayLabel: t("common.today"),
                    yesterdayLabel: t("common.yesterday"),
                }
            ),
        [items, i18n.language, t]
    );

    const dayTotals = useMemo(() => computeDayTotals(grouped), [grouped]);

    return (
        <Stack space="xs">
            <Stack space="m">
                <Back href="/wallet" />
                <Title size="page">{t("reward.history.title")}</Title>
            </Stack>

            {isLoading ? (
                <Skeleton count={3} height={110} />
            ) : (
                <Stack space="l">
                    <HistorySummary items={items} />
                    <HistoryDayGroup
                        group={grouped}
                        innerComponent={(item) => (
                            <RewardHistoryItemComponent item={item} />
                        )}
                        dayTotals={dayTotals}
                    />
                </Stack>
            )}
        </Stack>
    );
}
