import {
    Area,
    AreaChart,
    ChartTooltip,
    Grid,
    NumericYAxis,
    XAxis,
} from "@frak-labs/design-system/components/charts";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { vars } from "@frak-labs/design-system/theme";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { CampaignsOverview } from "@/module/campaigns/queries/queryOptions";
import * as styles from "./overview.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"];

const chartMargin = { top: 8, right: 44, bottom: 24, left: 8 };

export function ProjectedRevenueCard({
    projectedRevenue,
}: {
    projectedRevenue: CampaignsOverview["projectedRevenue"];
}) {
    const { t, i18n } = useTranslation();
    const currencyFormatter = new Intl.NumberFormat(i18n.language);
    // The visx time-series shell keys off a real Date x-axis; our series is
    // monthly, so map each label to the first of its month.
    const chartData = useMemo(
        () =>
            projectedRevenue.series.map((point, index) => {
                const month = MONTHS.indexOf(point.label);
                return {
                    date: new Date(2024, month === -1 ? index : month, 1),
                    actual: point.actual,
                    forecast: point.forecast,
                };
            }),
        [projectedRevenue.series]
    );

    return (
        <Stack space="m" className={styles.card}>
            <Stack space="xxs">
                <span className={styles.chartAmount}>
                    {currencyFormatter.format(projectedRevenue.total)}€
                </span>
                <Text variant="bodySmall" color="secondary">
                    {t("campaigns.overview.projected.title")}
                </Text>
                <Text variant="bodySmall" color="tertiary">
                    {t("campaigns.overview.projected.subtitle")}
                </Text>
            </Stack>
            <AreaChart
                className={styles.chartBox}
                data={chartData}
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
                <Area
                    dataKey="forecast"
                    fill={vars.icon.tertiary}
                    stroke={vars.icon.tertiary}
                />
                <XAxis tickMode="data" />
                <NumericYAxis
                    formatter={(v) => `${v / 1000}k€`}
                    ticks={[0, 5000, 10000, 15000]}
                />
                <ChartTooltip
                    rows={(point) => [
                        {
                            color: vars.icon.success,
                            label: t("campaigns.overview.projected.actual"),
                            value: (point.actual as number) ?? 0,
                        },
                        {
                            color: vars.icon.tertiary,
                            label: t("campaigns.overview.projected.forecast"),
                            value: (point.forecast as number) ?? 0,
                        },
                    ]}
                />
            </AreaChart>
            <Inline space="l">
                <Stack space="xxs">
                    <span className={styles.legendDotSuccess} />
                    <Text as="span" variant="caption">
                        {t("campaigns.overview.projected.actual")}
                    </Text>
                </Stack>
                <Stack space="xxs">
                    <span className={styles.legendDotForecast} />
                    <Text as="span" variant="caption">
                        {t("campaigns.overview.projected.forecast")}
                    </Text>
                </Stack>
            </Inline>
        </Stack>
    );
}
