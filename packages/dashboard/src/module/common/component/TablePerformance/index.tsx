"use client";

import { Table } from "@/module/common/component/Table";
import { computeWithPrecision } from "@/module/common/utils/computeWithPrecision";
import { createColumnHelper } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import type { Table as TableReact } from "@tanstack/react-table";
import { usePrevious } from "@uidotdev/usehooks";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import useSessionStorageState from "use-session-storage-state";

type TableData = {
    _id: string;
    title: string;
    result: number;
    share: number;
    coverage: number;
    print: number;
    ctr: number;
    costPerShare: number;
    cpc: number;
    costPerResult: number;
    amountSpent: number;
};

const mockData: TableData[] = [
    {
        _id: "1",
        title: "Campaign 1",
        result: 1365,
        share: 2152,
        coverage: 2152,
        print: 13254,
        ctr: 16.2,
        costPerShare: 0.58,
        cpc: 63.53,
        costPerResult: 1.09,
        amountSpent: 1253.54,
    },
    {
        _id: "2",
        title: "Campaign 2",
        result: 980,
        share: 1800,
        coverage: 1800,
        print: 10200,
        ctr: 14.5,
        costPerShare: 0.65,
        cpc: 70.0,
        costPerResult: 1.2,
        amountSpent: 1176.0,
    },
    {
        _id: "3",
        title: "Campaign 3",
        result: 1500,
        share: 2500,
        coverage: 2500,
        print: 15000,
        ctr: 16.7,
        costPerShare: 0.6,
        cpc: 62.0,
        costPerResult: 1.1,
        amountSpent: 1650.0,
    },
    {
        _id: "4",
        title: "Campaign 4",
        result: 1120,
        share: 1900,
        coverage: 1900,
        print: 12000,
        ctr: 15.8,
        costPerShare: 0.62,
        cpc: 65.0,
        costPerResult: 1.15,
        amountSpent: 1288.0,
    },
    {
        _id: "5",
        title: "Campaign 5",
        result: 1340,
        share: 2100,
        coverage: 2100,
        print: 14000,
        ctr: 15.0,
        costPerShare: 0.61,
        cpc: 64.0,
        costPerResult: 1.12,
        amountSpent: 1496.8,
    },
    {
        _id: "6",
        title: "Campaign 6",
        result: 1450,
        share: 2300,
        coverage: 2300,
        print: 14500,
        ctr: 15.9,
        costPerShare: 0.59,
        cpc: 66.0,
        costPerResult: 1.13,
        amountSpent: 1638.5,
    },
    {
        _id: "7",
        title: "Campaign 7",
        result: 1250,
        share: 2000,
        coverage: 2000,
        print: 13000,
        ctr: 15.4,
        costPerShare: 0.6,
        cpc: 68.0,
        costPerResult: 1.14,
        amountSpent: 1425.0,
    },
    {
        _id: "8",
        title: "Campaign 8",
        result: 1600,
        share: 2600,
        coverage: 2600,
        print: 16000,
        ctr: 16.3,
        costPerShare: 0.57,
        cpc: 61.0,
        costPerResult: 1.08,
        amountSpent: 1728.0,
    },
    {
        _id: "9",
        title: "Campaign 9",
        result: 1100,
        share: 1850,
        coverage: 1850,
        print: 11500,
        ctr: 15.7,
        costPerShare: 0.63,
        cpc: 67.0,
        costPerResult: 1.16,
        amountSpent: 1276.0,
    },
    {
        _id: "10",
        title: "Campaign 10",
        result: 1400,
        share: 2200,
        coverage: 2200,
        print: 14000,
        ctr: 15.8,
        costPerShare: 0.61,
        cpc: 65.0,
        costPerResult: 1.12,
        amountSpent: 1568.0,
    },
];

/*const mockDataTotal = [
    {
        result: 13043,
        share: 9180,
        coverage: 34256,
        print: 64376,
        ctr: 5,
        costPerShare: 1.74,
        cpc: 142.08,
        costPerResult: 2.18,
        amountSpent: 5972,
    },
];*/

type TableMetas = {
    page: number;
    limit: number;
    firstPage: string;
    lastPage: string;
    nextPage: string;
    previousPage: string;
    totalPages: number;
    totalResults: number;
};

const mockMetas: TableMetas = {
    page: 1,
    limit: 10,
    firstPage: "1",
    lastPage: "10",
    nextPage: "2",
    previousPage: "1",
    totalPages: 10,
    totalResults: 100,
};

const columnHelper = createColumnHelper<TableData>();

const initialFilteringState = { page: 1 };

function sumRows(table: TableReact<TableData>, column: string) {
    const total = table
        .getFilteredRowModel()
        .rows.reduce(
            (sum, row) => computeWithPrecision(sum, row.original[column], "+"),
            0
        );
    return <span>{total}</span>;
}

export function TablePerformance() {
    const [localTitle] = useSessionStorageState("title-autocomplete", {
        defaultValue: "",
    });
    const [filtering, setFiltering] = useSessionStorageState(
        "table-filtering",
        {
            defaultValue: initialFilteringState,
        }
    );
    const previousTitle = usePrevious(localTitle);

    useEffect(() => {
        if (previousTitle === undefined) {
            return;
        }
        if (localTitle !== previousTitle) {
            setFiltering(initialFilteringState);
        }
    }, [localTitle, previousTitle, setFiltering]);

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
                columnHelper.accessor("result", {
                    header: "Résultat",
                    footer: ({ table }) => sumRows(table, "result"),
                }),
                columnHelper.accessor("share", {
                    header: () => "Partage",
                    footer: ({ table }) => sumRows(table, "share"),
                }),
                columnHelper.accessor("coverage", {
                    header: () => "Couverture",
                    footer: ({ table }) => sumRows(table, "coverage"),
                }),
                columnHelper.accessor("print", {
                    header: () => "Impression",
                    footer: ({ table }) => sumRows(table, "print"),
                }),
                columnHelper.accessor("ctr", {
                    header: () => "CTR",
                    footer: ({ table }) => sumRows(table, "ctr"),
                }),
                columnHelper.accessor("costPerShare", {
                    header: () => "Coût par partage",
                    footer: ({ table }) => sumRows(table, "costPerShare"),
                }),
                columnHelper.accessor("cpc", {
                    header: () => "CPC",
                    footer: ({ table }) => sumRows(table, "cpc"),
                }),
                columnHelper.accessor("costPerResult", {
                    header: () => "Coût par résultat",
                    footer: ({ table }) => sumRows(table, "costPerResult"),
                }),
                columnHelper.accessor("amountSpent", {
                    header: () => "Montant dépensé",
                    footer: ({ table }) => sumRows(table, "amountSpent"),
                }),
            ] as ColumnDef<TableData>[],
        []
    );

    return (
        <>
            {
                mockData && mockMetas ? (
                    <Table<TableData, TableMetas>
                        data={mockData}
                        metas={mockMetas}
                        columns={columns}
                        filtering={filtering}
                        setFiltering={setFiltering}
                    />
                ) : null /*(
                <Skeleton height={600} />
            )*/
            }
        </>
    );
}
