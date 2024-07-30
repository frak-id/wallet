import { getMyCampaignsStats } from "@/context/campaigns/action/getCampaignsStats";
import type { ReactTableProps } from "@/module/common/component/Table";
import { TooltipTable } from "@/module/common/component/TooltipTable";
import { Skeleton } from "@module/component/Skeleton";
import { computeWithPrecision } from "@module/utils/computeWithPrecision";
import { useQuery } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import type { Table as TableReact } from "@tanstack/react-table";
import { usePrevious } from "@uidotdev/usehooks";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import useSessionStorageState from "use-session-storage-state";

const Table = dynamic<ReactTableProps<TableData, TableMetas>>(
    () => import("@/module/common/component/Table").then((mod) => mod.Table),
    {
        loading: () => <Skeleton />,
    }
);

type TableData = Awaited<ReturnType<typeof getMyCampaignsStats>>[number];

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

const columnHelper = createColumnHelper<TableData>();

const initialFilteringState = { page: 1 };

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

export function TablePerformance() {
    const { data, isLoading } = useQuery({
        queryKey: ["campaigns", "my-campaigns-stats"],
        queryFn: async () => await getMyCampaignsStats(),
    });

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
                columnHelper.accessor("referredInteractions", {
                    header: "Résultat",
                    footer: ({ table }) =>
                        sumRows(table, "referredInteractions"),
                }),
                columnHelper.accessor("createReferredLinkInteractions", {
                    header: () => "Partage",
                    footer: ({ table }) =>
                        sumRows(table, "createReferredLinkInteractions"),
                }),
                columnHelper.accessor("readInteractions", {
                    header: () => (
                        <TooltipTable
                            content={
                                <>
                                    <strong>Couverture</strong>
                                    <br /> Le nombre d’utilisateurs uniques qui
                                    ont vu votre contenu au moins une fois. La
                                    couverture est différente des impressions,
                                    qui peuvent inclure plusieurs vues de votre
                                    contenu par les mêmes utilisateurs.
                                </>
                            }
                        >
                            <span>Couverture</span>
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
                    header: () => "Coût par partage",
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
                    header: () => "Coût par résultat",
                    footer: ({ table }) =>
                        sumRows(table, "costPerResult", { dollar: true }),
                    cell: ({ getValue }) => `$${getValue().toFixed(2)}`,
                }),
                columnHelper.accessor("amountSpent", {
                    header: () => "Montant dépensé",
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
            <Table
                data={data}
                limit={data.length}
                columns={columns}
                filtering={filtering}
                setFiltering={setFiltering}
                pagination={false}
            />
        </>
    );
}
