import type {
    OverviewStatusBreakdown,
    OverviewTopCampaign,
} from "@frak-labs/backend-elysia/orchestration/schemas";
import { Badge } from "@frak-labs/design-system/components/Badge";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { type ColumnDef, createColumnHelper } from "@tanstack/react-table";
import { useMemo } from "react";
import { Table } from "@/module/common/component/Table";
import * as styles from "./overview.css";
import { StatusLegendBar } from "./StatusLegendBar";

const columnHelper = createColumnHelper<OverviewTopCampaign>();

const badgeVariantForStatus: Record<
    OverviewTopCampaign["status"],
    "success" | "warning" | "disabled" | "neutral"
> = {
    active: "success",
    paused: "warning",
    ended: "disabled",
    draft: "neutral",
};

const statusLabel: Record<OverviewTopCampaign["status"], string> = {
    active: "Active",
    paused: "Paused",
    ended: "Ended",
    draft: "Draft",
};

export function TopCampaignsCard({
    topCampaigns,
    statusBreakdown,
}: {
    topCampaigns: OverviewTopCampaign[];
    statusBreakdown: OverviewStatusBreakdown;
}) {
    const columns = useMemo(
        () =>
            [
                columnHelper.display({
                    id: "rank",
                    size: 40,
                    header: "#",
                    cell: ({ row }) => `0${row.index + 1}`.slice(-2),
                }),
                columnHelper.accessor("name", {
                    header: "Campaign name",
                    cell: ({ getValue }) => getValue(),
                }),
                columnHelper.accessor("status", {
                    header: "Status",
                    size: 140,
                    cell: ({ getValue }) => {
                        const status = getValue();
                        return (
                            <Badge
                                variant={badgeVariantForStatus[status]}
                                size="small"
                            >
                                {statusLabel[status]}
                            </Badge>
                        );
                    },
                }),
                columnHelper.accessor("sharingRate", {
                    header: () => "Sharing rate",
                    size: 140,
                    cell: ({ getValue }) => (
                        <Text
                            as="span"
                            variant="bodySmall"
                            weight="medium"
                            color="success"
                        >
                            {Math.round(getValue() * 100)}%
                        </Text>
                    ),
                    meta: { align: "right" },
                }),
            ] as ColumnDef<OverviewTopCampaign>[],
        []
    );

    return (
        <Stack space="m" className={styles.card}>
            <Text as="h2" variant="bodySmall" color="secondary">
                Top campaigns
            </Text>
            <Table
                data={topCampaigns}
                columns={columns}
                enableSorting={false}
            />
            <StatusLegendBar breakdown={statusBreakdown} />
        </Stack>
    );
}
