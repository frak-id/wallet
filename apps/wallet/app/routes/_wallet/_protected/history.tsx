import { Button } from "@frak-labs/design-system/components/Button";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Back } from "@/module/common/component/Back";
import { Skeleton } from "@/module/common/component/Skeleton";
import { Title } from "@/module/common/component/Title";
import { HistoryDayGroup } from "@/module/history/component/DayGroup";
import { HistoryEntryRow } from "@/module/history/component/HistoryEntryRow";
import { HistorySummary } from "@/module/history/component/HistorySummary";
import { useTrimRewardHistoryOnLeave } from "@/module/history/hook/useGetRewardHistory";
import { useHistory } from "@/module/history/hook/useHistory";
import { computeDayTotals } from "@/module/history/utils/computeHistoryStats";
import { groupByDay } from "@/module/history/utils/groupByDay";

export const Route = createFileRoute("/_wallet/_protected/history")({
    component: HistoryPage,
});

function HistoryPage() {
    const { t, i18n } = useTranslation();
    const {
        entries,
        rewards,
        isLoading,
        hasNextPage,
        fetchNextPage,
        isFetchingNextPage,
        isFetchNextPageError,
    } = useHistory();
    useTrimRewardHistoryOnLeave();

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
                    {isFetchingNextPage ? (
                        <Skeleton count={1} height={110} />
                    ) : isFetchNextPageError ? (
                        <Button
                            variant="secondary"
                            size="small"
                            onClick={() => fetchNextPage()}
                        >
                            {t("common.refresh")}
                        </Button>
                    ) : (
                        hasNextPage && (
                            <LoadMoreWhenVisible onVisible={fetchNextPage} />
                        )
                    )}
                </Stack>
            )}
        </Stack>
    );
}

function LoadMoreWhenVisible({ onVisible }: { onVisible: () => unknown }) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) onVisible();
            },
            { rootMargin: "400px" }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [onVisible]);

    return <div ref={ref} />;
}
