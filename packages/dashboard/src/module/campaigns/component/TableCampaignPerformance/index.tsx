import { getMyCampaignsStats } from "@/context/campaigns/action/getCampaignsStats";
import { TablePerformanceFilters } from "@/module/campaigns/component/TableCampaignPerformance/Filter";
import type { ReactTableProps } from "@/module/common/component/Table";
import { TooltipTable } from "@/module/common/component/TooltipTable";
import { useConvertToPreferredCurrency } from "@/module/common/hook/useConversionRate";
import { Skeleton } from "@shared/module/component/Skeleton";
import { computeWithPrecision } from "@shared/module/utils/computeWithPrecision";
import { useQuery } from "@tanstack/react-query";
import {
    type ColumnFiltersState,
    createColumnHelper,
} from "@tanstack/react-table";
import type { CellContext, ColumnDef } from "@tanstack/react-table";
import type { Table as TableReact } from "@tanstack/react-table";
import { atom } from "jotai";
import { useAtomValue } from "jotai/index";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo } from "react";

const Table = dynamic<ReactTableProps<TableData>>(
    () => import("@/module/common/component/Table").then((mod) => mod.Table),
    {
        loading: () => <Skeleton />,
    }
);

type TableData = Awaited<ReturnType<typeof getMyCampaignsStats>>[number];

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

export const tablePerformanceFiltersAtom = atom<ColumnFiltersState>([]);

export function TableCampaignPerformance() {
    const columnFilters = useAtomValue(tablePerformanceFiltersAtom);

    const { data, isLoading } = useQuery({
        queryKey: ["campaigns", "stats"],
        queryFn: () => getMyCampaignsStats(),
    });

    const columns = useMemo(
        () =>
            [
                columnHelper.accessor("title", {
                    header: "Campaign",
                    cell: ({ getValue }) => (
                        <Link href={"#"}>{getValue()}</Link>
                    ),
                    footer: "Total",
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
                        <AmountInPreferredCurrency
                            row={row}
                            getValue={getValue}
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
                                    <strong>Cost per Purchase</strong>
                                    <br /> Average cost per purchase.
                                </>
                            }
                        >
                            <span>Cost per Purchase</span>
                        </TooltipTable>
                    ),
                    cell: ({ row, getValue }) => (
                        <AmountInPreferredCurrency
                            row={row}
                            getValue={getValue}
                        />
                    ),
                }),
                columnHelper.accessor("amountSpent", {
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
                        <AmountInPreferredCurrency
                            row={row}
                            getValue={getValue}
                        />
                    ),
                }),
            ] as ColumnDef<TableData>[],
        []
    );

    if (!data || isLoading) {
        return <Skeleton />;
    }

    return (
        <>
            <TablePerformanceFilters />
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

function AmountInPreferredCurrency({
    row,
    getValue,
}: Pick<CellContext<TableData, number>, "row" | "getValue">) {
    const converted = useConvertToPreferredCurrency({
        amount: getValue(),
        token: row.original.token,
    });

    if (converted === undefined)
        return (
            <span>
                Raw: {getValue()}, token: {row.original.token}
            </span>
        );

    return <span>{converted}</span>;
}
