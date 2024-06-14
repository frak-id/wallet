import { Badge } from "@/module/common/component/Badge";
import type { ReactTableProps } from "@/module/common/component/Table";
import { formatDate } from "@/module/common/utils/formatDate";
import { formatPrice } from "@/module/common/utils/formatPrice";
import { Checkbox } from "@/module/forms/Checkbox";
import { Switch } from "@/module/forms/Switch";
import { createColumnHelper } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { usePrevious } from "@uidotdev/usehooks";
import { Eye, Pencil, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import useSessionStorageState from "use-session-storage-state";
import styles from "./index.module.css";

const Table = dynamic<ReactTableProps<TableData, TableMetas>>(
    () => import("@/module/common/component/Table").then((mod) => mod.Table),
    { ssr: false }
);

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
        status: "Running",
        date: "2021-09-01",
        budget: 1000,
        enabled: true,
    },
    {
        _id: "2",
        title: "Campaign 2",
        status: "Stopped",
        date: "2021-10-15",
        budget: 1500,
        enabled: false,
    },
    {
        _id: "3",
        title: "Campaign 3",
        status: "Running",
        date: "2021-11-05",
        budget: 2000,
        enabled: true,
    },
    {
        _id: "4",
        title: "Campaign 4",
        status: "Draft",
        date: "2021-12-01",
        budget: 2500,
        enabled: false,
    },
    {
        _id: "5",
        title: "Campaign 5",
        status: "Running",
        date: "2022-01-10",
        budget: 1200,
        enabled: true,
    },
    {
        _id: "6",
        title: "Campaign 6",
        status: "Stopped",
        date: "2022-02-20",
        budget: 3000,
        enabled: false,
    },
    {
        _id: "7",
        title: "Campaign 7",
        status: "Draft",
        date: "2022-03-15",
        budget: 1800,
        enabled: false,
    },
    {
        _id: "8",
        title: "Campaign 8",
        status: "Running",
        date: "2022-04-05",
        budget: 2200,
        enabled: true,
    },
    {
        _id: "9",
        title: "Campaign 9",
        status: "Stopped",
        date: "2022-05-25",
        budget: 1600,
        enabled: false,
    },
    {
        _id: "10",
        title: "Campaign 10",
        status: "Draft",
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
                    header: ({ table }) => (
                        <Checkbox
                            {...{
                                checked: table.getIsSomeRowsSelected()
                                    ? "indeterminate"
                                    : table.getIsAllPageRowsSelected(),
                                onCheckedChange: (checked) => {
                                    if (checked !== "indeterminate") {
                                        table.toggleAllPageRowsSelected(
                                            checked
                                        );
                                    }
                                },
                            }}
                        />
                    ),
                    cell: ({ row }) => (
                        <Checkbox
                            {...{
                                checked: row.getIsSelected() ?? "indeterminate",
                                disabled: !row.getCanSelect(),
                                onCheckedChange: (checked) => {
                                    if (checked !== "indeterminate") {
                                        row.toggleSelected(checked);
                                    }
                                },
                            }}
                        />
                    ),
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
                    header: () => "Campaign",
                    cell: ({ getValue }) => (
                        <Link href={"#"}>{getValue()}</Link>
                    ),
                }),
                columnHelper.accessor("status", {
                    header: () => "Status",
                    cell: ({ getValue }) => (
                        <Badge variant={"secondary"}>{getValue()}</Badge>
                    ),
                }),
                columnHelper.accessor("date", {
                    header: () => "Date",
                    cell: ({ getValue }) => formatDate(new Date(getValue())),
                }),
                columnHelper.accessor("budget", {
                    header: () => "Budget",
                    cell: ({ getValue }) => formatPrice(getValue()),
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
                    <Table
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
