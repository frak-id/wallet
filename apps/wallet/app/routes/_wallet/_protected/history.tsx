import { Stack } from "@frak-labs/design-system/components/Stack";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Back } from "@/module/common/component/Back";
import { Skeleton } from "@/module/common/component/Skeleton";
import { Title } from "@/module/common/component/Title";
import { HistoryDayGroup } from "@/module/history/component/DayGroup";
import { HistoryEntryRow } from "@/module/history/component/HistoryEntryRow";
import { HistorySummary } from "@/module/history/component/HistorySummary";
import { useHistory } from "@/module/history/hook/useHistory";
import { computeDayTotals } from "@/module/history/utils/computeHistoryStats";
import { groupByDay } from "@/module/history/utils/groupByDay";

export const Route = createFileRoute("/_wallet/_protected/history")({
    component: HistoryPage,
});

function HistoryPage() {
    const { t, i18n } = useTranslation();
    const { entries, rewards, isLoading } = useHistory();

    const grouped = useMemo(
        () =>
            groupByDay(entries, {
                locale: i18n.language,
                todayLabel: t("common.today"),
                yesterdayLabel: t("common.yesterday"),
            }),
        [entries, i18n.language, t]
    );

    const dayTotals = useMemo(
        () =>
            computeDayTotals(
                Object.fromEntries(
                    Object.entries(grouped).map(([day, dayEntries]) => [
                        day,
                        dayEntries.flatMap((entry) =>
                            entry.kind === "reward" ? [entry.reward] : []
                        ),
                    ])
                )
            ),
        [grouped]
    );

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
                    <HistorySummary items={rewards} />
                    <HistoryDayGroup
                        group={grouped}
                        innerComponent={(entry) => (
                            <HistoryEntryRow entry={entry} />
                        )}
                        dayTotals={dayTotals}
                    />
                </Stack>
            )}
        </Stack>
    );
}
