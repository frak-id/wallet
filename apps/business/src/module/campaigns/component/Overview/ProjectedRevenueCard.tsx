import { AreaChart } from "@frak-labs/design-system/components/AreaChart";
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
        <div className={styles.card}>
            <div>
                <span className={styles.chartAmount}>
                    {currencyFormatter.format(projectedRevenue.total)}€
                </span>
                <Text variant="bodySmall" color="secondary">
                    Projected revenue
                </Text>
                <Text variant="bodySmall" color="tertiary">
                    Based on current growth trend
                </Text>
            </div>
            <AreaChart
                data={projectedRevenue.series}
                yMax={15000}
                yTicks={[0, 5000, 10000, 15000]}
            />
            <div className={styles.revenueLegend}>
                <Text as="span" variant="caption" className={styles.legendRow}>
                    <span className={styles.legendDotSuccess} />
                    Actual revenue
                </Text>
                <Text as="span" variant="caption" className={styles.legendRow}>
                    <span className={styles.legendDotForecast} />
                    Forecast revenue
                </Text>
            </div>
        </div>
    );
}
