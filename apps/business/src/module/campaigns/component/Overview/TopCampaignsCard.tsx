import { Badge } from "@frak-labs/design-system/components/Badge";
import { Text } from "@frak-labs/design-system/components/Text";
import { type ColumnDef, createColumnHelper } from "@tanstack/react-table";
import { useMemo } from "react";
import type { CampaignsOverview } from "@/module/campaigns/queries/queryOptions";
import { Table } from "@/module/common/component/Table";
import * as styles from "./overview.css";
import { StatusLegendBar } from "./StatusLegendBar";

type TopCampaign = CampaignsOverview["topCampaigns"][number];

const columnHelper = createColumnHelper<TopCampaign>();

const badgeVariantForStatus: Record<
    TopCampaign["status"],
    "success" | "warning" | "disabled" | "neutral"
> = {
    active: "success",
    paused: "warning",
    ended: "disabled",
    draft: "neutral",
};

const statusLabel: Record<TopCampaign["status"], string> = {
    active: "Active",
    paused: "Paused",
    ended: "Ended",
    draft: "Draft",
};

export function TopCampaignsCard({
    topCampaigns,
    statusBreakdown,
}: {
    topCampaigns: CampaignsOverview["topCampaigns"];
    statusBreakdown: CampaignsOverview["statusBreakdown"];
}) {
    const columns = useMemo(
        () =>
            [
                columnHelper.display({
                    id: "rank",
                    header: "#",
                    cell: ({ row }) => `0${row.index + 1}`.slice(-2),
                }),
                columnHelper.accessor("name", {
                    header: "Campaign name",
                    cell: ({ getValue }) => getValue(),
                }),
                columnHelper.accessor("status", {
                    header: "Status",
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
            ] as ColumnDef<TopCampaign>[],
        []
    );

    return (
        <div className={styles.card}>
            <Text as="h2" variant="bodySmall" color="secondary">
                Top campaigns
            </Text>
            <Table
                data={topCampaigns}
                columns={columns}
                enableSorting={false}
            />
            <StatusLegendBar breakdown={statusBreakdown} />
        </div>
    );
}
