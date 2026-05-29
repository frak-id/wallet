import type { OverviewStatusBreakdown } from "@frak-labs/backend-elysia/orchestration/schemas";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { vars } from "@frak-labs/design-system/theme";
import { useTranslation } from "react-i18next";
import * as styles from "./statusLegendBar.css";

const statusOrder: Array<keyof OverviewStatusBreakdown> = [
    "active",
    "paused",
    "draft",
    "ended",
];

const statusColor: Record<keyof OverviewStatusBreakdown, string> = {
    active: vars.icon.success,
    paused: vars.icon.warning,
    draft: vars.icon.tertiary,
    ended: vars.icon.secondary,
};

export function StatusLegendBar({
    breakdown,
}: {
    breakdown: OverviewStatusBreakdown;
}) {
    const { t } = useTranslation();
    const total = statusOrder.reduce((acc, k) => acc + breakdown[k], 0) || 1;

    return (
        <Stack space="s">
            <Text as="span" variant="bodySmall" color="secondary">
                {t("campaigns.overview.statusLegend.title")}
            </Text>
            <div className={styles.bar} aria-hidden="true">
                {statusOrder.map((key) =>
                    breakdown[key] > 0 ? (
                        <div
                            key={key}
                            className={styles.segment}
                            style={{
                                width: `${(breakdown[key] / total) * 100}%`,
                                backgroundColor: statusColor[key],
                            }}
                        />
                    ) : null
                )}
            </div>
            <Inline space="xl" wrap>
                {statusOrder.map((key) => (
                    <Inline key={key} space="xxs" alignY="center">
                        <span
                            className={styles.dot}
                            style={{ backgroundColor: statusColor[key] }}
                            aria-hidden="true"
                        />
                        <Text as="span" variant="caption">
                            {breakdown[key]} {t(`campaigns.status.${key}`)}
                        </Text>
                    </Inline>
                ))}
            </Inline>
        </Stack>
    );
}
