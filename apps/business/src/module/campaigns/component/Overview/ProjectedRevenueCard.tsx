import type {
    OverviewGranularity,
    OverviewSeries,
    OverviewSeriesBucket,
    RevenueKpi,
} from "@frak-labs/backend-elysia/orchestration/schemas";
import { Card } from "@frak-labs/design-system/components/Card";
import {
    Area,
    AreaChart,
    ChartTooltip,
    Grid,
    NumericYAxis,
    XAxis,
} from "@frak-labs/design-system/components/charts";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { LegendItem } from "@frak-labs/design-system/components/LegendItem";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { vars } from "@frak-labs/design-system/theme";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ChartEmptyState } from "./ChartEmptyState";
import { EMPTY_AMOUNT } from "./constants";
import * as styles from "./overview.css";

const FORECAST_BUCKETS = 2;
const FORECAST_LOOKBACK = 3;
const DEFAULT_CURRENCY = "EUR";

type AreaPoint = {
    date: Date;
    actual?: number;
    forecast?: number;
};

const chartMargin = { top: 8, right: 44, bottom: 24, left: 8 };

export function ProjectedRevenueCard({
    series,
    revenue,
}: {
    series: OverviewSeries;
    revenue: RevenueKpi;
}) {
    const { t, i18n } = useTranslation();
    const locale = i18n.language;
    const currency = revenue.currency ?? DEFAULT_CURRENCY;

    const { data, total, currencyFormatter } = useMemo(() => {
        const data = buildAreaSeries(series.buckets, series.granularity);
        const total = data.reduce(
            (acc, p) => acc + (p.actual ?? p.forecast ?? 0),
            0
        );
        const currencyFormatter = new Intl.NumberFormat(locale, {
            style: "currency",
            currency,
            maximumFractionDigits: 0,
        });
        return { data, total, currencyFormatter };
    }, [series, locale, currency]);

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
                        {isEmpty
                            ? EMPTY_AMOUNT
                            : currencyFormatter.format(total)}
                    </span>
                    <Text as="h2" variant="bodySmall" color="secondary">
                        {t("campaigns.overview.projected.title")}
                    </Text>
                    <Text variant="bodySmall" color="tertiary">
                        {t("campaigns.overview.projected.subtitle")}
                    </Text>
                </Stack>
                {isEmpty ? (
                    <ChartEmptyState />
                ) : (
                    <>
                        <AreaChart
                            className={styles.chartBox}
                            data={data}
                            locale={i18n.language}
                            margin={chartMargin}
                            xDataKey="date"
                        >
                            <Grid vertical={false} />
                            <Area
                                dataKey="actual"
                                fill={vars.icon.success}
                                stroke={vars.icon.success}
                            />
                            {/* Forecast draws lighter than its legend dot. */}
                            <Area
                                dataKey="forecast"
                                fill={vars.border.default}
                                stroke={vars.border.default}
                            />
                            <XAxis tickMode="data" />
                            <NumericYAxis
                                formatter={(v) => `${v / 1000}k€`}
                                ticks={[0, 5000, 10000, 15000]}
                            />
                            <ChartTooltip
                                rows={(point) =>
                                    [
                                        point.actual != null
                                            ? {
                                                  color: vars.icon.success,
                                                  label: t(
                                                      "campaigns.overview.projected.actual"
                                                  ),
                                                  value: point.actual as number,
                                              }
                                            : null,
                                        point.forecast != null
                                            ? {
                                                  color: vars.icon.tertiary,
                                                  label: t(
                                                      "campaigns.overview.projected.forecast"
                                                  ),
                                                  value: point.forecast as number,
                                              }
                                            : null,
                                    ].filter((row) => row !== null)
                                }
                            />
                        </AreaChart>
                        <Inline space="xl">
                            <LegendItem
                                layout="stacked"
                                swatchColor={vars.icon.success}
                            >
                                {t("campaigns.overview.projected.actual")}
                            </LegendItem>
                            <LegendItem
                                layout="stacked"
                                swatchColor={vars.icon.tertiary}
                            >
                                {t("campaigns.overview.projected.forecast")}
                            </LegendItem>
                        </Inline>
                    </>
                )}
            </Stack>
        </Card>
    );
}

function buildAreaSeries(
    buckets: OverviewSeriesBucket[],
    granularity: OverviewGranularity
): AreaPoint[] {
    const data: AreaPoint[] = buckets.map((b) => ({
        date: new Date(b.bucket),
        actual: b.revenue,
    }));

    const forecasts = projectForecast(buckets.map((b) => b.revenue));
    if (forecasts.length === 0 || buckets.length === 0) return data;

    // The last actual bucket also carries the first forecast value so the
    // visx area stays continuous across the actual → forecast seam.
    data[data.length - 1].forecast = forecasts[0];

    const lastBucketDate = new Date(buckets[buckets.length - 1].bucket);
    for (let i = 1; i < forecasts.length; i += 1) {
        const nextDate = addBuckets(lastBucketDate, granularity, i);
        data.push({
            date: nextDate,
            forecast: forecasts[i],
        });
    }

    return data;
}

function addBuckets(
    base: Date,
    granularity: OverviewGranularity,
    steps: number
): Date {
    const next = new Date(base.getTime());
    if (granularity === "month") {
        next.setUTCMonth(next.getUTCMonth() + steps);
    } else {
        next.setUTCDate(next.getUTCDate() + steps);
    }
    return next;
}

/**
 * Naive linear extrapolation — averages the slope across the last
 * `FORECAST_LOOKBACK` buckets and projects `FORECAST_BUCKETS` ahead.
 * Same logic that used to live in the backend orchestrator; moved here
 * so the response stays cacheable and forecast horizon is FE-tunable.
 */
function projectForecast(
    values: number[],
    steps: number = FORECAST_BUCKETS,
    lookback: number = FORECAST_LOOKBACK
): number[] {
    if (values.length === 0) return [];
    const recent = values.slice(-lookback);
    const last = recent[recent.length - 1];

    if (recent.length < 2) {
        return Array.from({ length: steps }, () => last);
    }

    let slopeSum = 0;
    for (let i = 1; i < recent.length; i += 1) {
        slopeSum += recent[i] - recent[i - 1];
    }
    const slope = slopeSum / (recent.length - 1);

    return Array.from({ length: steps }, (_, i) =>
        Math.max(last + slope * (i + 1), 0)
    );
}
