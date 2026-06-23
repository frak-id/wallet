import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { BarChartIcon } from "@frak-labs/design-system/icons";
import { useTranslation } from "react-i18next";
import * as styles from "./overview.css";

/**
 * Compact no-data placeholder for the overview chart cards: a muted bar-chart
 * icon over a single "No data to display yet." line, centered in the chart
 * area. Used in place of the visx chart / funnel / pie when a card's series is
 * empty.
 */
export function ChartEmptyState() {
    const { t } = useTranslation();
    return (
        <div className={styles.chartEmpty}>
            <Stack space="xxs" align="center">
                <BarChartIcon
                    className={styles.chartEmptyIcon}
                    width={24}
                    height={24}
                />
                <Text
                    as="span"
                    variant="bodySmall"
                    weight="medium"
                    color="disabled"
                    align="center"
                >
                    {t("campaigns.overview.empty.noData")}
                </Text>
            </Stack>
        </div>
    );
}
