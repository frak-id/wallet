import type {
    OverviewGranularity,
    OverviewSeries,
} from "@frak-labs/backend-elysia/orchestration/schemas";
import { Card } from "@frak-labs/design-system/components/Card";
import {
    Bar,
    BarChart,
    BarXAxis,
    ChartTooltip,
    NumericYAxis,
    ReferenceLine,
} from "@frak-labs/design-system/components/charts";
import { LegendItem } from "@frak-labs/design-system/components/LegendItem";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { vars } from "@frak-labs/design-system/theme";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { getDateTimeFormat } from "@/module/common/utils/intlCache";
import { ChartEmptyState } from "./ChartEmptyState";
import { EMPTY_AMOUNT } from "./constants";
import * as styles from "./overview.css";

const DAY_MS = 24 * 60 * 60 * 1000;
const DAYS_PER_MONTH = 30;

const chartMargin = { top: 8, right: 44, bottom: 40, left: 8 };

export function PurchasesCard({ series }: { series: OverviewSeries }) {
    const { t, i18n } = useTranslation();
    const locale = i18n.language;

    const { data, total, avgPerMonth, numberFormatter } = useMemo(() => {
        const labelFormatter = bucketLabelFormatter(locale, series.granularity);
        const data = series.buckets.map((b) => ({
            label: labelFormatter.format(new Date(b.bucket)),
            value: b.purchaseCount,
        }));
        const total = series.buckets.reduce(
            (acc, b) => acc + b.purchaseCount,
            0
        );
        const months = approxSpanInMonths(series.buckets);
        const avgPerMonth = Math.round(total / Math.max(months, 1));
        const numberFormatter = new Intl.NumberFormat(locale, {
            maximumFractionDigits: 0,
        });
        return { data, total, avgPerMonth, numberFormatter };
    }, [series, locale]);

    const isEmpty = total === 0;

    return (
        <Card radius="m">
            <Stack space="m">
                <Stack space="xxs">
                    <span
                        className={
                            isEmpty
                                ? styles.chartAmountEmpty
                                : styles.chartAmount
                        }
                    >
                        {isEmpty ? EMPTY_AMOUNT : numberFormatter.format(total)}
                    </span>
                    <Text as="h2" variant="bodySmall" color="secondary">
                        {t("campaigns.overview.purchases.title")}
                    </Text>
                </Stack>
                {isEmpty ? (
                    <ChartEmptyState />
                ) : (
                    <>
                        <BarChart
                            barWidth={16}
                            className={styles.chartBox}
                            data={data}
                            locale={i18n.language}
                            margin={chartMargin}
                            xDataKey="label"
                        >
                            <Bar
                                dataKey="value"
                                fill={vars.icon.action}
                                lineCap="butt"
                            />
                            <ReferenceLine
                                label={t(
                                    "campaigns.overview.purchases.avgPerMonth",
                                    {
                                        value: numberFormatter.format(
                                            avgPerMonth
                                        ),
                                    }
                                )}
                                y={avgPerMonth}
                            />
                            <BarXAxis fadeNearCursor={false} />
                            <NumericYAxis
                                formatter={(v) =>
                                    v === 0 ? "0" : `${v / 1000}k`
                                }
                                ticks={[0, 5000]}
                            />
                            <ChartTooltip
                                rows={(point) => [
                                    {
                                        color: vars.icon.action,
                                        label: t(
                                            "campaigns.overview.purchases.tooltip"
                                        ),
                                        value: (point.value as number) ?? 0,
                                    },
                                ]}
                                showDatePill={false}
                            />
                        </BarChart>
                        <LegendItem
                            layout="stacked"
                            swatchColor={vars.icon.action}
                        >
                            {t("campaigns.overview.purchases.title")}
                        </LegendItem>
                    </>
                )}
            </Stack>
        </Card>
    );
}

function bucketLabelFormatter(
    locale: string,
    granularity: OverviewGranularity
): Intl.DateTimeFormat {
    return getDateTimeFormat(
        locale,
        granularity === "month"
            ? { month: "short", timeZone: "UTC" }
            : { month: "short", day: "2-digit", timeZone: "UTC" }
    );
}

/**
 * Approximate the span covered by the visible buckets in months. Used
 * for the "avg per month" reference line — the backend trims the series
 * to the buckets that actually carry data, so this is the right
 * denominator for what the chart is showing.
 */
function approxSpanInMonths(buckets: { bucket: string }[]): number {
    if (buckets.length < 2) return 1;
    const first = new Date(buckets[0].bucket).getTime();
    const last = new Date(buckets[buckets.length - 1].bucket).getTime();
    const days = Math.max((last - first) / DAY_MS, 1);
    return days / DAYS_PER_MONTH;
}
