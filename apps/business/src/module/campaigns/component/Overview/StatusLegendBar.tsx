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
        ended: vars.icon.primary,
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
        <div className={styles.container}>
            <span className={styles.label}>Status</span>
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
            <div className={styles.legend}>
                {statusOrder.map((key) => (
                    <span key={key} className={styles.legendItem}>
                        <span
                            className={styles.dot}
                            style={{ backgroundColor: statusColor[key] }}
                        />
                        {breakdown[key]} {statusLabel[key]}
                    </span>
                ))}
            </div>
        </div>
    );
}
