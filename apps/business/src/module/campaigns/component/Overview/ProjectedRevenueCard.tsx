import { AreaChart } from "@frak-labs/design-system/components/AreaChart";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import type { CampaignsOverview } from "@/module/campaigns/queries/queryOptions";
import * as styles from "./overview.css";

const currencyFormatter = new Intl.NumberFormat("en-US");

export function ProjectedRevenueCard({
    projectedRevenue,
}: {
    projectedRevenue: CampaignsOverview["projectedRevenue"];
}) {
    return (
        <Stack space="m" className={styles.card}>
            <Stack space="xxs">
                <span className={styles.chartAmount}>
                    {currencyFormatter.format(projectedRevenue.total)}€
                </span>
                <Text variant="bodySmall" color="secondary">
                    Projected revenue
                </Text>
                <Text variant="bodySmall" color="tertiary">
                    Based on current growth trend
                </Text>
            </Stack>
            <AreaChart
                data={projectedRevenue.series}
                yMax={15000}
                yTicks={[0, 5000, 10000, 15000]}
            />
            <Inline space="m">
                <Inline space="xs" alignY="center">
                    <span className={styles.legendDotSuccess} />
                    <Text as="span" variant="caption">
                        Actual revenue
                    </Text>
                </Inline>
                <Inline space="xs" alignY="center">
                    <span className={styles.legendDotForecast} />
                    <Text as="span" variant="caption">
                        Forecast revenue
                    </Text>
                </Inline>
            </Inline>
        </Stack>
    );
}
