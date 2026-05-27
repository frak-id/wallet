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
                <Text as="span" variant="heading3" weight="bold">
                    {currencyFormatter.format(projectedRevenue.total)}€
                </Text>
                <Text variant="bodySmall" color="secondary">
                    Projected revenue
                </Text>
                <span className={styles.cardSubtitle}>
                    Based on current growth trend
                </span>
            </div>
            <AreaChart
                data={projectedRevenue.series}
                yMax={15000}
                yTicks={[0, 5000, 10000, 15000]}
            />
            <div className={styles.revenueLegend}>
                <span className={styles.legendRow}>
                    <span className={styles.legendDotSuccess} />
                    Actual revenue
                </span>
                <span className={styles.legendRow}>
                    <span className={styles.legendDotForecast} />
                    Forecast revenue
                </span>
            </div>
        </div>
    );
}
