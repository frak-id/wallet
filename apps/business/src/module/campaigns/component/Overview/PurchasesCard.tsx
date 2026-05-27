import { BarChart } from "@frak-labs/design-system/components/BarChart";
import { Text } from "@frak-labs/design-system/components/Text";
import type { CampaignsOverview } from "@/module/campaigns/queries/queryOptions";
import * as styles from "./overview.css";

const numberFormatter = new Intl.NumberFormat("en-US");

export function PurchasesCard({
    purchases,
}: {
    purchases: CampaignsOverview["purchases"];
}) {
    return (
        <div className={styles.card}>
            <div>
                <Text as="span" variant="heading3" weight="bold">
                    {numberFormatter.format(purchases.total)}
                </Text>
                <Text variant="bodySmall" color="secondary">
                    Purchases generated
                </Text>
            </div>
            <BarChart
                data={purchases.series}
                avg={purchases.avgPerMonth}
                avgLabel={`${numberFormatter.format(
                    purchases.avgPerMonth
                )} avg/mo`}
            />
            <span className={styles.cardSubtitle}>· Purchases generated</span>
        </div>
    );
}
