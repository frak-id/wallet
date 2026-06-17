import { Text } from "@frak-labs/design-system/components/Text";
import type { Row } from "@tanstack/react-table";
import type { CampaignWithStats } from "@/module/campaigns/hook/useCampaignsWithStats";
import { formatPrice } from "@/module/common/utils/formatPrice";
import { MutedText } from "./MutedText";
import * as styles from "./table-campaigns.css";

export function CellBudget({ row }: { row: Row<CampaignWithStats> }) {
    const { budgetConfig, budgetUsed } = row.original;
    const firstBudget = budgetConfig?.[0];

    if (!firstBudget) return <MutedText>–</MutedText>;

    const total = firstBudget.amount;
    const used = budgetUsed?.[firstBudget.label]?.used ?? 0;
    const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;

    return (
        <div>
            <div className={styles.budgetRow}>
                <Text
                    variant="caption"
                    as="span"
                    weight="medium"
                    color="action"
                >
                    {formatPrice(used, undefined, "EUR")}
                </Text>
                <Text
                    variant="caption"
                    as="span"
                    weight="medium"
                    color="secondary"
                >
                    /{formatPrice(total, undefined, "EUR")}
                </Text>
            </div>
            <div className={styles.budgetBarTrack}>
                <div
                    className={styles.budgetBarFill}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}
