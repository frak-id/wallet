import { getMyCampaignsStats } from "@/context/campaigns/action/getCampaignsStats";
import { TablePerformanceFilters } from "@/module/campaigns/component/TableCampaignPerformance/Filter";
import type { ReactTableProps } from "@/module/common/component/Table";
import { TooltipTable } from "@/module/common/component/TooltipTable";
import { Skeleton } from "@module/component/Skeleton";
import { computeWithPrecision } from "@module/utils/computeWithPrecision";
import { useQuery } from "@tanstack/react-query";
import {
    type ColumnFiltersState,
    createColumnHelper,
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
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

function sumRows(
    table: TableReact<TableData>,
    column: keyof TableData,
    formatting?: { dollar?: boolean }
) {
    const total = table
        .getFilteredRowModel()
        .rows.reduce(
            (sum, row) =>
                computeWithPrecision(sum, row.original[column] as number, "+"),
            0
        );
    if (formatting?.dollar) {
        return <span>${total.toFixed(2)}</span>;
    }
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
        queryKey: ["campaigns", "my-campaigns-stats"],
        queryFn: async () => await getMyCampaignsStats(),
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
                columnHelper.accessor("referredInteractions", {
                    header: "Result",
                    footer: ({ table }) =>
                        sumRows(table, "referredInteractions"),
                }),
                columnHelper.accessor("createReferredLinkInteractions", {
                    header: () => "Share",
                    footer: ({ table }) =>
                        sumRows(table, "createReferredLinkInteractions"),
                }),
                columnHelper.accessor("readInteractions", {
                    header: () => (
                        <TooltipTable
                            content={
                                <>
                                    <strong>Coverage</strong>
                                    <br /> Le nombre d’utilisateurs uniques qui
                                    ont vu votre contenu au moins une fois. La
                                    couverture est différente des impressions,
                                    qui peuvent inclure plusieurs vues de votre
                                    contenu par les mêmes utilisateurs.
                                </>
                            }
                        >
                            <span>Coverage</span>
                        </TooltipTable>
                    ),
                    footer: ({ table }) => sumRows(table, "readInteractions"),
                }),
                columnHelper.accessor("openInteractions", {
                    header: () => "Impression",
                    footer: ({ table }) => sumRows(table, "openInteractions"),
                }),
                columnHelper.accessor("sharingRate", {
                    header: () => "Sharing Rate",
                    footer: ({ table }) => avgPercentages(table, "sharingRate"),
                    cell: ({ getValue }) => `${(getValue() * 100).toFixed(2)}%`,
                }),
                columnHelper.accessor("costPerShare", {
                    header: () => "Cost per share",
                    footer: ({ table }) =>
                        sumRows(table, "costPerShare", { dollar: true }),
                    cell: ({ getValue }) => `$${getValue().toFixed(2)}`,
                }),
                columnHelper.accessor("ctr", {
                    header: () => "CTR",
                    footer: ({ table }) => avgPercentages(table, "ctr"),
                    cell: ({ getValue }) => `${(getValue() * 100).toFixed(2)}%`,
                }),
                columnHelper.accessor("costPerResult", {
                    header: () => "Cost per Result",
                    footer: ({ table }) =>
                        sumRows(table, "costPerResult", { dollar: true }),
                    cell: ({ getValue }) => `$${getValue().toFixed(2)}`,
                }),
                columnHelper.accessor("amountSpent", {
                    header: () => "Amount Spent",
                    footer: ({ table }) =>
                        sumRows(table, "amountSpent", { dollar: true }),
                    cell: ({ getValue }) => `$${getValue().toFixed(2)}`,
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
