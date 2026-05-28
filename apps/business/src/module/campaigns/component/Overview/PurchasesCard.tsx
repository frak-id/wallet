import {
    Bar,
    BarChart,
    BarXAxis,
    ChartTooltip,
    NumericYAxis,
    ReferenceLine,
} from "@frak-labs/design-system/components/charts";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { vars } from "@frak-labs/design-system/theme";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { CampaignsOverview } from "@/module/campaigns/queries/queryOptions";
import * as styles from "./overview.css";

const chartMargin = { top: 8, right: 44, bottom: 40, left: 8 };

const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
];

export function PurchasesCard({
    purchases,
}: {
    purchases: CampaignsOverview["purchases"];
}) {
    const { t, i18n } = useTranslation();
    const numberFormatter = new Intl.NumberFormat(i18n.language);

    // The series carries English month abbreviations from the API; re-format
    // each to the active locale so the bar axis + tooltip title localize.
    const series = useMemo(() => {
        const monthFmt = new Intl.DateTimeFormat(i18n.language, {
            month: "short",
        });
        return purchases.series.map((point) => {
            const month = MONTHS.indexOf(point.label);
            return month === -1
                ? point
                : {
                      ...point,
                      label: monthFmt.format(new Date(2024, month, 1)),
                  };
        });
    }, [purchases.series, i18n.language]);

    return (
        <Stack space="m" className={styles.card}>
            <Stack space="xxs">
                <span className={styles.chartAmount}>
                    {numberFormatter.format(purchases.total)}
                </span>
                <Text variant="bodySmall" color="secondary">
                    {t("campaigns.overview.purchases.title")}
                </Text>
            </Stack>
            <BarChart
                barWidth={16}
                className={styles.chartBox}
                data={series}
                locale={i18n.language}
                margin={chartMargin}
                xDataKey="label"
            >
                <Bar dataKey="value" fill={vars.icon.action} lineCap="butt" />
                <ReferenceLine
                    label={t("campaigns.overview.purchases.avgPerMonth", {
                        value: numberFormatter.format(purchases.avgPerMonth),
                    })}
                    y={purchases.avgPerMonth}
                />
                <BarXAxis fadeNearCursor={false} />
                <NumericYAxis
                    formatter={(v) => (v === 0 ? "0" : `${v / 1000}k`)}
                    ticks={[0, 5000]}
                />
                <ChartTooltip
                    rows={(point) => [
                        {
                            color: vars.icon.action,
                            label: t("campaigns.overview.purchases.tooltip"),
                            value: (point.value as number) ?? 0,
                        },
                    ]}
                    showDatePill={false}
                />
            </BarChart>
            <Stack space="xxs">
                <span className={styles.legendDotPrimary} />
                <Text as="span" variant="caption">
                    {t("campaigns.overview.purchases.title")}
                </Text>
            </Stack>
        </Stack>
    );
}
