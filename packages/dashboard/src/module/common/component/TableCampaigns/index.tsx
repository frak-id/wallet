"use client";

import { Badge } from "@/module/common/component/Badge";
import { Table } from "@/module/common/component/Table";
import { TooltipTable } from "@/module/common/component/TooltipTable";
import { Checkbox } from "@/module/forms/Checkbox";
import { Switch } from "@/module/forms/Switch";
import { createColumnHelper } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { usePrevious } from "@uidotdev/usehooks";
import { Eye, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import useSessionStorageState from "use-session-storage-state";
import styles from "./index.module.css";

type TableData = {
    _id: string;
    title: string;
    status: string;
    date: string;
    budget: number;
    enabled: boolean;
};

const mockData: TableData[] = [
    {
        _id: "1",
        title: "Campaign 1",
        status: "Active",
        date: "2021-09-01",
        budget: 1000,
        enabled: true,
    },
    {
        _id: "2",
        title: "Campaign 2",
        status: "Inactive",
        date: "2021-10-15",
        budget: 1500,
        enabled: false,
    },
    {
        _id: "3",
        title: "Campaign 3",
        status: "Active",
        date: "2021-11-05",
        budget: 2000,
        enabled: true,
    },
    {
        _id: "4",
        title: "Campaign 4",
        status: "Completed",
        date: "2021-12-01",
        budget: 2500,
        enabled: false,
    },
    {
        _id: "5",
        title: "Campaign 5",
        status: "Active",
        date: "2022-01-10",
        budget: 1200,
        enabled: true,
    },
    {
        _id: "6",
        title: "Campaign 6",
        status: "Inactive",
        date: "2022-02-20",
        budget: 3000,
        enabled: false,
    },
    {
        _id: "7",
        title: "Campaign 7",
        status: "Completed",
        date: "2022-03-15",
        budget: 1800,
        enabled: false,
    },
    {
        _id: "8",
        title: "Campaign 8",
        status: "Active",
        date: "2022-04-05",
        budget: 2200,
        enabled: true,
    },
    {
        _id: "9",
        title: "Campaign 9",
        status: "Inactive",
        date: "2022-05-25",
        budget: 1600,
        enabled: false,
    },
    {
        _id: "10",
        title: "Campaign 10",
        status: "Completed",
        date: "2022-06-30",
        budget: 2700,
        enabled: false,
    },
];

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

export function TableCampaigns() {
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
                columnHelper.display({
                    id: "checkbox",
                    header: () => <Checkbox />,
                    cell: () => <Checkbox />,
                }),
                columnHelper.accessor("enabled", {
                    header: "On/Off",
                    cell: ({ getValue }) => {
                        return (
                            <Switch
                                checked={getValue()}
                                onCheckedChange={(value) => console.log(value)}
                            />
                        );
                    },
                }),
                columnHelper.accessor("title", {
                    cell: (props) => <Link href={"#"}>{props.getValue()}</Link>,
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
                            <span>Campaign</span>
                        </TooltipTable>
                    ),
                }),
                columnHelper.accessor("status", {
                    header: () => "Status",
                    cell: (props) => (
                        <Badge variant={"secondary"}>{props.getValue()}</Badge>
                    ),
                }),
                columnHelper.accessor("date", {
                    header: () => "Date",
                }),
                columnHelper.accessor("budget", {
                    header: () => "Budget",
                }),
                columnHelper.display({
                    header: "Action",
                    cell: () => (
                        <div className={styles.table__actions}>
                            <button type={"button"}>
                                <Eye size={20} absoluteStrokeWidth={true} />
                            </button>
                            <button type={"button"}>
                                <Pencil size={20} absoluteStrokeWidth={true} />
                            </button>
                            <button type={"button"}>
                                <Trash2 size={20} absoluteStrokeWidth={true} />
                            </button>
                        </div>
                    ),
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
