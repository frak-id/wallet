import { Skeleton } from "@frak-labs/design-system/components/Skeleton";
import { Stack } from "@frak-labs/design-system/components/Stack";
import type { ColumnDef } from "@tanstack/react-table";
import {
    type CellContext,
    type ColumnFiltersState,
    createColumnHelper,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { CampaignDetailsSheet } from "@/module/campaigns/component/CampaignDetailsSheet";
import { CampaignStateTag } from "@/module/campaigns/component/TableCampaigns/CampaignStateTag";
import { CellRowMenu } from "@/module/campaigns/component/TableCampaigns/CellRowMenu";
import {
    type CampaignTab,
    TableCampaignFilters,
} from "@/module/campaigns/component/TableCampaigns/Filter";
import { isEnded } from "@/module/campaigns/component/TableCampaigns/isEnded";
import { useGetCampaigns } from "@/module/campaigns/hook/useGetCampaigns";
import { Table } from "@/module/common/component/Table";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { formatDate } from "@/module/common/utils/formatDate";
import { formatPrice } from "@/module/common/utils/formatPrice";
import type { CampaignWithActions } from "@/types/Campaign";
import * as styles from "./table-campaigns.css";

const columnHelper = createColumnHelper<CampaignWithActions>();

export function TableCampaigns() {
    const { data } = useGetCampaigns();
    const merchantId = useActiveMerchantId();
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [selectedCampaign, setSelectedCampaign] = useState<
        CampaignWithActions | undefined
    >();

    const columns = useMemo(
        () =>
            [
                columnHelper.accessor("name", {
                    enableSorting: false,
                    header: () => "Campaign",
                    cell: ({ getValue }) => getValue() as string,
                }),
                columnHelper.accessor("status", {
                    enableSorting: true,
                    header: () => "Status",
                    id: "status",
                    cell: ({ getValue, row }) => (
                        <CampaignStateTag
                            status={getValue()}
                            expiresAt={row.original.expiresAt}
                            bankDistributionStatus={
                                row.original.bankDistributionStatus
                            }
                        />
                    ),
                    filterFn: (row, _, value: CampaignTab) => {
                        if (value === "all") return true;
                        const { status, expiresAt } = row.original;
                        const ended = isEnded(status, expiresAt);
                        if (value === "ended") return ended;
                        // An ended campaign is no longer "active" for filter purposes.
                        if (ended) return false;
                        return status === value;
                    },
                }),
                {
                    id: "date",
                    header: () => "Date",
                    accessorFn: (row) =>
                        formatDate(new Date(row.publishedAt || row.createdAt)),
                    filterFn: (row, _, value: DateRange) => {
                        if (!value?.from) return true;
                        const date = new Date(
                            row.original.publishedAt || row.original.createdAt
                        );
                        const from = new Date(value.from);
                        from.setHours(0, 0, 0, 0);
                        const to = value.to ? new Date(value.to) : from;
                        to.setHours(23, 59, 59, 999);
                        return date >= from && date <= to;
                    },
                },
                columnHelper.accessor("budgetConfig", {
                    header: () => "Budget",
                    cell: ({ row }) => <CellBudget row={row} />,
                }),
                columnHelper.display({
                    id: "rowMenu",
                    header: () => null,
                    cell: ({ row }) => (
                        <div className={styles.rowMenuCell}>
                            <CellRowMenu row={row} merchantId={merchantId} />
                        </div>
                    ),
                }),
            ] as ColumnDef<CampaignWithActions>[],
        [merchantId]
    );

    if (!data) {
        return <Skeleton variant="rect" height={250} />;
    }

    return (
        data && (
            <>
                <TableCampaignFilters
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                />
                <Table
                    data={data}
                    columns={columns}
                    enableSorting={true}
                    enableFiltering={true}
                    columnFilters={columnFilters}
                    onRowClick={(row) => setSelectedCampaign(row.original)}
                />
                <CampaignDetailsSheet
                    campaign={selectedCampaign}
                    onOpenChange={(open) => {
                        if (!open) setSelectedCampaign(undefined);
                    }}
                />
            </>
        )
    );
}

function CellBudget({
    row,
}: Pick<CellContext<CampaignWithActions, unknown>, "row">) {
    const budgetConfig = row.original.budgetConfig;
    const budgetUsed = row.original.budgetUsed;
    const firstBudget = budgetConfig?.[0];

    if (!firstBudget) {
        return <span>-</span>;
    }

    const used = budgetUsed?.[firstBudget.label]?.used ?? 0;
    const remaining = firstBudget.amount - used;

    return (
        <Stack as="span" space="xxs">
            <span className={styles.tableBudgetAmount}>
                {formatPrice(remaining, undefined, "EUR")} /{" "}
                {formatPrice(firstBudget.amount, undefined, "EUR")}
            </span>
            <span className={styles.tableBudgetType}>
                {firstBudget.label || "Global"}
            </span>
        </Stack>
    );
}
