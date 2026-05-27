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
            <AreaChart data={projectedRevenue.series} />
            <div style={{ display: "flex", gap: 16 }}>
                <span className={styles.cardSubtitle}>· Actual revenue</span>
                <span className={styles.cardSubtitle}>· Forecast revenue</span>
            </div>
        </div>
    );
}
