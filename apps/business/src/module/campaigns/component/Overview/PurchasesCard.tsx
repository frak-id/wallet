import {
    Bar,
    BarChart,
    BarXAxis,
    ChartTooltip,
    NumericYAxis,
    ReferenceLine,
} from "@frak-labs/design-system/components/BarChart";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { vars } from "@frak-labs/design-system/theme";
import type { CampaignsOverview } from "@/module/campaigns/queries/queryOptions";
import * as styles from "./overview.css";

const numberFormatter = new Intl.NumberFormat("en-US");

const chartMargin = { top: 8, right: 44, bottom: 40, left: 8 };

export function PurchasesCard({
    purchases,
}: {
    purchases: CampaignsOverview["purchases"];
}) {
    return (
        <Stack space="m" className={styles.card}>
            <Stack space="xxs">
                <span className={styles.chartAmount}>
                    {numberFormatter.format(purchases.total)}
                </span>
                <Text variant="bodySmall" color="secondary">
                    Purchases generated
                </Text>
            </Stack>
            <BarChart
                barWidth={16}
                className={styles.chartBox}
                data={purchases.series}
                margin={chartMargin}
                xDataKey="label"
            >
                <Bar dataKey="value" fill={vars.icon.action} lineCap="butt" />
                <ReferenceLine
                    label={`${numberFormatter.format(
                        purchases.avgPerMonth
                    )}\navg/mo`}
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
                            label: "Purchases",
                            value: (point.value as number) ?? 0,
                        },
                    ]}
                    showDatePill={false}
                />
            </BarChart>
            <Stack space="xxs">
                <span className={styles.legendDotPrimary} />
                <Text as="span" variant="caption">
                    Purchases generated
                </Text>
            </Stack>
        </Stack>
    );
}
