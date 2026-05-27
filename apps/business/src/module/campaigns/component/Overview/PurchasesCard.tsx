import { BarChart } from "@frak-labs/design-system/components/BarChart";
import { Stack } from "@frak-labs/design-system/components/Stack";
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
                data={purchases.series}
                avg={purchases.avgPerMonth}
                avgLabel={`${numberFormatter.format(
                    purchases.avgPerMonth
                )} avg/mo`}
                yMax={5000}
                yTicks={[0, 1000, 2000, 3000, 4000, 5000]}
            />
            <Stack space="xxs">
                <span className={styles.legendDotPrimary} />
                <Text as="span" variant="caption">
                    Purchases generated
                </Text>
            </Stack>
        </Stack>
    );
}
