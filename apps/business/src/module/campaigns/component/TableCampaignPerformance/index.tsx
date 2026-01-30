import { Skeleton } from "@frak-labs/ui/component/Skeleton";
import { computeWithPrecision } from "@frak-labs/ui/utils/computeWithPrecision";
import { useSuspenseQuery } from "@tanstack/react-query";
import type {
    CellContext,
    ColumnDef,
    Table as TableReact,
} from "@tanstack/react-table";
import {
    type ColumnFiltersState,
    createColumnHelper,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import type { CampaignStats } from "@/module/campaigns/api/campaignStatsApi";
import { TablePerformanceFilters } from "@/module/campaigns/component/TableCampaignPerformance/Filter";
import { campaignsStatsQueryOptions } from "@/module/campaigns/queries/queryOptions";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { Table } from "@/module/common/component/Table";
import { TooltipTable } from "@/module/common/component/TooltipTable";
import { useConvertToPreferredCurrency } from "@/module/common/hook/useConversionRate";
import { useTokenMetadata } from "@/module/common/hook/useTokenMetadata";

type TableData = CampaignStats;

const columnHelper = createColumnHelper<TableData>();

function sumRows(table: TableReact<TableData>, column: keyof TableData) {
    const total = table
        .getFilteredRowModel()
        .rows.reduce(
            (sum, row) =>
                computeWithPrecision(sum, row.original[column] as number, "+"),
            0
        );
    return <span>{total}</span>;
}

function avgPercentages(table: TableReact<TableData>, column: keyof TableData) {
    const allRows = table.getFilteredRowModel().rows;
    const totalPercent = allRows.reduce(
        (sum, row) =>
            computeWithPrecision(sum, row.original[column] as number, "+"),
        0
    );
    const average = totalPercent / allRows.length;

    return <span>{(average * 100).toFixed(2)}%</span>;
}

export function TableCampaignPerformance() {
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const isDemoMode = useIsDemoMode();

    const { data } = useSuspenseQuery(campaignsStatsQueryOptions(isDemoMode));

    const columns = useMemo(
        () =>
            [
                columnHelper.accessor("campaignName", {
                    header: "Campaign",
                    cell: ({ getValue }) => <span>{getValue()}</span>,
                    footer: "Total",
                }),
                columnHelper.accessor("trigger", {
                    header: "Event",
                    cell: ({ getValue }) => getValue(),
                }),
                columnHelper.accessor("ambassador", {
                    header: () => (
                        <TooltipTable
                            content={
                                <>
                                    <strong>Ambassador</strong>
                                    <br /> Ambassador on your product (users who
                                    are the first to create a share link).
                                </>
                            }
                        >
                            <span>Ambassador</span>
                        </TooltipTable>
                    ),
                    footer: ({ table }) => sumRows(table, "ambassador"),
                }),
                columnHelper.accessor("createReferredLinkInteractions", {
                    header: () => (
                        <TooltipTable
                            content={
                                <>
                                    <strong>Share</strong>
                                    <br /> Amount of share link created on your
                                    product.
                                </>
                            }
                        >
                            <span>Share</span>
                        </TooltipTable>
                    ),
                    footer: ({ table }) =>
                        sumRows(table, "createReferredLinkInteractions"),
                }),
                columnHelper.accessor("referredInteractions", {
                    header: () => (
                        <TooltipTable
                            content={
                                <>
                                    <strong>Result</strong>
                                    <br /> Amount of user who discovered your
                                    product via ambassador.
                                </>
                            }
                        >
                            <span>Result</span>
                        </TooltipTable>
                    ),
                    footer: ({ table }) =>
                        sumRows(table, "referredInteractions"),
                }),
                columnHelper.accessor("purchaseInteractions", {
                    header: () => (
                        <TooltipTable
                            content={
                                <>
                                    <strong>Purchase</strong>
                                    <br /> Number of purchase performed thanks
                                    to this campaign.
                                </>
                            }
                        >
                            <span>Purchase</span>
                        </TooltipTable>
                    ),
                    footer: ({ table }) =>
                        sumRows(table, "purchaseInteractions"),
                }),
                columnHelper.accessor("sharingRate", {
                    header: () => (
                        <TooltipTable
                            content={
                                <>
                                    <strong>Sharing Rate</strong>
                                    <br /> Number of sharing link created to the
                                    number of wallet activated.
                                </>
                            }
                        >
                            <span>Sharing Rate</span>
                        </TooltipTable>
                    ),
                    footer: ({ table }) => avgPercentages(table, "sharingRate"),
                    cell: ({ getValue }) => `${(getValue() * 100).toFixed(2)}%`,
                }),
                columnHelper.accessor("costPerShare", {
                    header: () => (
                        <TooltipTable
                            content={
                                <>
                                    <strong>Cost per share</strong>
                                    <br /> Average cost per share link creation
                                </>
                            }
                        >
                            <span>Cost per share</span>
                        </TooltipTable>
                    ),
                    cell: ({ row, getValue }) => (
                        <RawAmountInPreferredCurrency
                            row={row}
                            rawAmount={getValue()}
                        />
                    ),
                }),
                columnHelper.accessor("ctr", {
                    header: () => (
                        <TooltipTable
                            content={
                                <>
                                    <strong>CTR</strong>
                                    <br /> Click-through rate, the number of
                                    user who discovered your product via
                                    ambassador.
                                </>
                            }
                        >
                            <span>CTR</span>
                        </TooltipTable>
                    ),
                    footer: ({ table }) => avgPercentages(table, "ctr"),
                    cell: ({ getValue }) => `${(getValue() * 100).toFixed(2)}%`,
                }),
                columnHelper.accessor("costPerPurchase", {
                    header: () => (
                        <TooltipTable
                            content={
                                <>
                                    <strong>Cost Per Action</strong>
                                    <br /> Average cost per action.
                                </>
                            }
                        >
                            <span>Cost Per Action</span>
                        </TooltipTable>
                    ),
                    cell: ({ row, getValue }) => (
                        <RawAmountInPreferredCurrency
                            row={row}
                            rawAmount={getValue()}
                        />
                    ),
                }),
                columnHelper.accessor("totalRewards", {
                    header: () => (
                        <TooltipTable
                            content={
                                <>
                                    <strong>Amount Spent</strong>
                                    <br /> The total amount you spent for on
                                    this campaign.
                                </>
                            }
                        >
                            <span>Amount Spent</span>
                        </TooltipTable>
                    ),
                    cell: ({ row, getValue }) => (
                        <RawAmountInPreferredCurrency
                            row={row}
                            rawAmount={getValue()}
                        />
                    ),
                }),
            ] as ColumnDef<TableData>[],
        []
    );

    if (!data) {
        return <Skeleton />;
    }

    return (
        <>
            <TablePerformanceFilters
                columnFilters={columnFilters}
                setColumnFilters={setColumnFilters}
            />
            <Table
                data={data}
                columns={columns}
                enableSorting={true}
                enableFiltering={true}
                columnFilters={columnFilters}
            />
        </>
    );
}

function RawAmountInPreferredCurrency({
    row,
    rawAmount,
}: {
    row: CellContext<TableData, string>["row"];
    rawAmount: string;
}) {
    const token = row.original.tokenAddress ?? undefined;
    const { data: tokenMeta } = useTokenMetadata(token);
    const converted = useConvertToPreferredCurrency({
        token,
        balance: BigInt(rawAmount),
        decimals: tokenMeta?.decimals,
    });

    if (converted === undefined) return null;

    return <span>{converted}</span>;
}
