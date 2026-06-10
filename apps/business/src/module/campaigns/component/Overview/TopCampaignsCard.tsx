import type {
    OverviewStatusBreakdown,
    OverviewTopCampaign,
} from "@frak-labs/backend-elysia/orchestration/schemas";
import { Badge } from "@frak-labs/design-system/components/Badge";
import { Card } from "@frak-labs/design-system/components/Card";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { type ColumnDef, createColumnHelper } from "@tanstack/react-table";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Table } from "@/module/common/component/Table";
import { EMPTY_AMOUNT } from "./constants";
import { StatusLegendBar } from "./StatusLegendBar";

const columnHelper = createColumnHelper<OverviewTopCampaign>();

const numberFormatter = new Intl.NumberFormat("en-US");

const badgeVariantForStatus: Record<
    OverviewTopCampaign["status"],
    "success" | "warning" | "disabled" | "neutral"
> = {
    active: "success",
    paused: "warning",
    ended: "disabled",
    draft: "neutral",
};

const statusLabelKey: Record<
    string,
    | "campaigns.status.active"
    | "campaigns.status.paused"
    | "campaigns.status.ended"
    | "campaigns.status.draft"
> = {
    active: "campaigns.status.active",
    paused: "campaigns.status.paused",
    ended: "campaigns.status.ended",
    draft: "campaigns.status.draft",
};

export function TopCampaignsCard({
    topCampaigns,
    statusBreakdown,
}: {
    topCampaigns: OverviewTopCampaign[];
    statusBreakdown: OverviewStatusBreakdown;
}) {
    const { t } = useTranslation();
    const columns = useMemo(
        () =>
            [
                columnHelper.display({
                    id: "rank",
                    size: 40,
                    header: t("campaigns.overview.top.rank"),
                    cell: ({ row }) => `0${row.index + 1}`.slice(-2),
                }),
                columnHelper.accessor("name", {
                    header: t("campaigns.overview.top.name"),
                    cell: ({ getValue }) => getValue(),
                }),
                columnHelper.accessor("status", {
                    header: t("campaigns.table.status"),
                    size: 140,
                    cell: ({ getValue }) => {
                        const status = getValue();
                        return (
                            <Badge
                                variant={badgeVariantForStatus[status]}
                                size="small"
                            >
                                {t(
                                    statusLabelKey[status] ??
                                        "campaigns.status.unknown"
                                )}
                            </Badge>
                        );
                    },
                }),
                columnHelper.accessor("rewardsCount", {
                    header: () => t("campaigns.table.rewards"),
                    size: 140,
                    cell: ({ getValue }) => {
                        const count = getValue();
                        if (count === 0) {
                            return (
                                <Text
                                    as="span"
                                    variant="bodySmall"
                                    color="disabled"
                                >
                                    {EMPTY_AMOUNT}
                                </Text>
                            );
                        }
                        return (
                            <Text
                                as="span"
                                variant="bodySmall"
                                weight="medium"
                                color="success"
                            >
                                {numberFormatter.format(count)}
                            </Text>
                        );
                    },
                    meta: { align: "right" },
                }),
            ] as ColumnDef<OverviewTopCampaign>[],
        [t]
    );

    return (
        <Card radius="m">
            <Stack space="m">
                <Text as="h2" variant="bodySmall" color="secondary">
                    {t("campaigns.overview.top.title")}
                </Text>
                <Table
                    data={topCampaigns}
                    columns={columns}
                    enableSorting={false}
                />
                <StatusLegendBar breakdown={statusBreakdown} />
            </Stack>
        </Card>
    );
}
