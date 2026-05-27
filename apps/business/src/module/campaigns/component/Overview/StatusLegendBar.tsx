import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { vars } from "@frak-labs/design-system/theme";
import type { CampaignsOverview } from "@/module/campaigns/queries/queryOptions";
import * as styles from "./statusLegendBar.css";

const statusOrder: Array<keyof CampaignsOverview["statusBreakdown"]> = [
    "active",
    "paused",
    "draft",
    "ended",
];

const statusColor: Record<keyof CampaignsOverview["statusBreakdown"], string> =
    {
        active: vars.icon.success,
        paused: vars.icon.warning,
        draft: vars.icon.tertiary,
        ended: vars.icon.secondary,
    };

const statusLabel: Record<keyof CampaignsOverview["statusBreakdown"], string> =
    {
        active: "active",
        paused: "paused",
        draft: "draft",
        ended: "ended",
    };

export function StatusLegendBar({
    breakdown,
}: {
    breakdown: CampaignsOverview["statusBreakdown"];
}) {
    const total = statusOrder.reduce((acc, k) => acc + breakdown[k], 0) || 1;

    return (
        <Stack space="s">
            <Text as="span" variant="bodySmall" color="secondary">
                Status
            </Text>
            <div className={styles.bar}>
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
                        />
                        <Text as="span" variant="caption">
                            {breakdown[key]} {statusLabel[key]}
                        </Text>
                    </Inline>
                ))}
            </Inline>
        </Stack>
    );
}
